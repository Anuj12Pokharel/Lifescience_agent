import re

from django.contrib.auth import authenticate
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework import serializers
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import CustomUser, InviteToken, OTPCode, UserProfile


# ── Token generators ─────────────────────────────────────────────────────────

class _EmailVerificationTokenGenerator(PasswordResetTokenGenerator):
    """Separate generator from password-reset so tokens are not interchangeable."""

    def _make_hash_value(self, user, timestamp):
        return f"{user.pk}{timestamp}{user.is_verified}{user.email}"


email_verification_token = _EmailVerificationTokenGenerator()
password_reset_token = PasswordResetTokenGenerator()


# ── Shared helpers ────────────────────────────────────────────────────────────

_PASSWORD_RE = {
    "upper": re.compile(r"[A-Z]"),
    "lower": re.compile(r"[a-z]"),
    "digit": re.compile(r"\d"),
    "special": re.compile(r'[!@#$%^&*()\-_=+\[\]{};:\'",.<>/?\\|`~]'),
}


def validate_password_strength(value: str) -> str:
    errors = []
    if len(value) < 8:
        errors.append("Must be at least 8 characters.")
    if not _PASSWORD_RE["upper"].search(value):
        errors.append("Must contain at least one uppercase letter.")
    if not _PASSWORD_RE["lower"].search(value):
        errors.append("Must contain at least one lowercase letter.")
    if not _PASSWORD_RE["digit"].search(value):
        errors.append("Must contain at least one digit.")
    if not _PASSWORD_RE["special"].search(value):
        errors.append("Must contain at least one special character.")
    if errors:
        raise serializers.ValidationError(errors)
    return value


def _decode_uid(uid_b64: str) -> CustomUser:
    """Decode a base64-encoded UUID and return the matching user or raise ValidationError."""
    try:
        uid = force_str(urlsafe_base64_decode(uid_b64))
        return CustomUser.objects.get(pk=uid)
    except (TypeError, ValueError, OverflowError, CustomUser.DoesNotExist):
        raise serializers.ValidationError("Invalid or expired link.")


def _get_client_ip(request) -> str | None:
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


# ── Read serializers ──────────────────────────────────────────────────────────

class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = ["first_name", "last_name", "avatar", "bio", "phone", "timezone", "updated_at"]
        read_only_fields = ["updated_at"]


class UserSerializer(serializers.ModelSerializer):
    profile = UserProfileSerializer(read_only=True)
    company_name = serializers.CharField(source="company.name", read_only=True, default=None)
    organization = serializers.SerializerMethodField()

    class Meta:
        model = CustomUser
        fields = [
            "id",
            "email",
            "role",
            "is_verified",
            "last_login_ip",
            "date_joined",
            "last_login",
            "profile",
            "company_name",
            "organization",
        ]
        read_only_fields = fields

    def get_organization(self, user):
        # Admin owns an org
        try:
            org = user.owned_organization
            return {"id": str(org.id), "name": org.name, "slug": org.slug}
        except Exception:
            pass
        # Regular user belongs to an org via membership
        try:
            membership = user.org_memberships.select_related("org").filter(is_active=True).first()
            if membership:
                org = membership.org
                return {"id": str(org.id), "name": org.name, "slug": org.slug}
        except Exception:
            pass
        # User in a group — get org via group creator
        try:
            from apps.agents.group_models import AgentGroupMembership
            gm = AgentGroupMembership.objects.select_related(
                "group__created_by__owned_organization"
            ).filter(user=user, is_active=True, group__is_active=True).first()
            if gm and gm.group.created_by:
                org = gm.group.created_by.owned_organization
                return {"id": str(org.id), "name": org.name, "slug": org.slug}
        except Exception:
            pass
        return None


# ── Auth serializers ──────────────────────────────────────────────────────────

class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=254)
    password = serializers.CharField(write_only=True)
    password_confirm = serializers.CharField(write_only=True)

    def validate_email(self, value: str) -> str:
        value = value.lower().strip()
        if CustomUser.objects.filter(email=value).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value

    def validate_password(self, value: str) -> str:
        return validate_password_strength(value)

    def validate(self, attrs: dict) -> dict:
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError({"password_confirm": "Passwords do not match."})
        return attrs

    def create(self, validated_data: dict) -> CustomUser:
        validated_data.pop("password_confirm")
        user = CustomUser.objects.create_user(
            email=validated_data["email"],
            password=validated_data["password"],
            role=CustomUser.Role.USER,  # self-registration is always role=user
        )
        UserProfile.objects.create(user=user)
        return user


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs: dict) -> dict:
        email = attrs["email"].lower().strip()
        password = attrs["password"]
        request = self.context.get("request")

        # --- user existence check ---
        try:
            user = CustomUser.objects.get(email=email)
        except CustomUser.DoesNotExist:
            # Generic message to avoid account enumeration
            raise serializers.ValidationError(
                {"email": "No active account found with the given credentials."}
            )

        if not user.is_active:
            if user.role == CustomUser.Role.ADMIN and user.approval_status == CustomUser.ApprovalStatus.PENDING:
                raise serializers.ValidationError({"email": "Your registration is under review. You will be notified by email once approved."})
            if user.role == CustomUser.Role.ADMIN and user.approval_status == CustomUser.ApprovalStatus.REJECTED:
                reason = f" Reason: {user.rejection_reason}" if user.rejection_reason else ""
                raise serializers.ValidationError({"email": f"Your registration was rejected.{reason}"})
            if user.role == CustomUser.Role.ADMIN and user.approval_status == CustomUser.ApprovalStatus.APPROVED:
                raise serializers.ValidationError({"email": "Your account has been deactivated by the platform administrator. Please contact support to reactivate your account."})
            raise serializers.ValidationError({"email": "This account has been deactivated. Please contact your administrator."})

        # --- lockout check (re-read is_locked which uses locked_until > now()) ---
        if user.is_locked:
            raise serializers.ValidationError(
                {
                    "email": (
                        f"Account temporarily locked due to too many failed attempts. "
                        f"Try again after {user.locked_until.strftime('%Y-%m-%d %H:%M UTC')}."
                    )
                }
            )

        # --- credential check ---
        authenticated_user = authenticate(request=request, username=email, password=password)
        if authenticated_user is None:
            user.increment_failed_login(max_attempts=5, lockout_minutes=30)
            # Re-read after increment to get updated state
            user.refresh_from_db(fields=["failed_login_attempts", "locked_until"])
            if user.is_locked:
                raise serializers.ValidationError(
                    {
                        "password": (
                            "Account locked after 5 failed attempts. "
                            "Try again in 30 minutes."
                        )
                    }
                )
            remaining = max(0, 5 - user.failed_login_attempts)
            raise serializers.ValidationError(
                {
                    "password": (
                        f"Incorrect password. "
                        f"{remaining} attempt(s) remaining before your account is locked."
                    )
                }
            )

        # --- successful auth ---
        user.reset_failed_login()

        if request:
            ip = _get_client_ip(request)
            CustomUser.objects.filter(pk=user.pk).update(last_login_ip=ip)

        attrs["user"] = authenticated_user
        return attrs


class LogoutSerializer(serializers.Serializer):
    refresh = serializers.CharField()

    def validate_refresh(self, value: str) -> str:
        try:
            self._token = RefreshToken(value)
        except TokenError as exc:
            raise serializers.ValidationError(str(exc))
        return value

    def save(self) -> None:
        self._token.blacklist()


class ForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value: str) -> str:
        value = value.lower().strip()
        # Always store internal state but never reveal existence to caller
        try:
            self._user = CustomUser.objects.get(email=value, is_active=True)
        except CustomUser.DoesNotExist:
            self._user = None
        return value

    def get_token_data(self) -> tuple[str | None, str | None]:
        """Return (uid_b64, token) if user exists, else (None, None)."""
        if self._user is None:
            return None, None
        uid = urlsafe_base64_encode(force_bytes(self._user.pk))
        token = password_reset_token.make_token(self._user)
        return uid, token


class ResetPasswordSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField(write_only=True)
    new_password_confirm = serializers.CharField(write_only=True)

    def validate_new_password(self, value: str) -> str:
        return validate_password_strength(value)

    def validate(self, attrs: dict) -> dict:
        if attrs["new_password"] != attrs["new_password_confirm"]:
            raise serializers.ValidationError(
                {"new_password_confirm": "Passwords do not match."}
            )

        user = _decode_uid(attrs["uid"])

        if not password_reset_token.check_token(user, attrs["token"]):
            raise serializers.ValidationError(
                {"token": "Reset link is invalid or has expired."}
            )

        attrs["user"] = user
        return attrs

    def save(self) -> None:
        user: CustomUser = self.validated_data["user"]
        user.set_password(self.validated_data["new_password"])
        user.reset_failed_login()  # also clears locked_until
        user.save(update_fields=["password", "failed_login_attempts", "locked_until"])


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True)
    new_password_confirm = serializers.CharField(write_only=True)

    def validate_new_password(self, value: str) -> str:
        return validate_password_strength(value)

    def validate(self, attrs: dict) -> dict:
        user: CustomUser = self.context["request"].user

        if not user.check_password(attrs["old_password"]):
            raise serializers.ValidationError(
                {"old_password": "Current password is incorrect."}
            )
        if attrs["new_password"] != attrs["new_password_confirm"]:
            raise serializers.ValidationError(
                {"new_password_confirm": "Passwords do not match."}
            )
        if attrs["old_password"] == attrs["new_password"]:
            raise serializers.ValidationError(
                {"new_password": "New password must differ from your current password."}
            )
        return attrs

    def save(self) -> None:
        user: CustomUser = self.context["request"].user
        user.set_password(self.validated_data["new_password"])
        user.save(update_fields=["password"])


class VerifyEmailSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()

    def validate(self, attrs: dict) -> dict:
        user = _decode_uid(attrs["uid"])

        if user.is_verified:
            raise serializers.ValidationError(
                {"uid": "This email address has already been verified."}
            )

        if not email_verification_token.check_token(user, attrs["token"]):
            raise serializers.ValidationError(
                {"token": "Verification link is invalid or has expired."}
            )

        attrs["user"] = user
        return attrs

    def save(self) -> None:
        user: CustomUser = self.validated_data["user"]
        user.is_verified = True
        user.save(update_fields=["is_verified"])


# ── SuperAdmin/Admin: user management serializers ─────────────────────────────

class ManagedBySerializer(serializers.ModelSerializer):
    """Compact representation of the admin who manages a user."""
    class Meta:
        model = CustomUser
        fields = ["id", "email"]
        read_only_fields = fields


class AdminUserListSerializer(serializers.ModelSerializer):
    """Compact read serializer for paginated user lists."""
    is_locked = serializers.BooleanField(read_only=True)
    managed_by = ManagedBySerializer(read_only=True)

    class Meta:
        model = CustomUser
        fields = [
            "id",
            "email",
            "role",
            "managed_by",
            "is_verified",
            "is_active",
            "is_locked",
            "failed_login_attempts",
            "last_login_ip",
            "last_login",
            "date_joined",
        ]
        read_only_fields = fields


class AdminUserDetailSerializer(serializers.ModelSerializer):
    """Full read serializer for a single user, including profile and lock metadata."""
    profile = UserProfileSerializer(read_only=True)
    is_locked = serializers.BooleanField(read_only=True)
    managed_by = ManagedBySerializer(read_only=True)

    class Meta:
        model = CustomUser
        fields = [
            "id",
            "email",
            "role",
            "managed_by",
            "is_verified",
            "is_active",
            "is_locked",
            "failed_login_attempts",
            "locked_until",
            "last_login_ip",
            "last_login",
            "date_joined",
            "profile",
        ]
        read_only_fields = fields


class AdminUpdateRoleSerializer(serializers.Serializer):
    """Superadmin-only: change a user's role."""
    role = serializers.ChoiceField(choices=CustomUser.Role.choices)

    def validate_role(self, value: str) -> str:
        target: CustomUser = self.context["target_user"]
        requester: CustomUser = self.context["request"].user
        if target == requester and value != CustomUser.Role.SUPERADMIN:
            raise serializers.ValidationError("You cannot demote your own account.")
        return value

    def save(self) -> CustomUser:
        user: CustomUser = self.context["target_user"]
        new_role = self.validated_data["role"]
        user.role = new_role
        # Keep Django permission flags in sync with role
        if new_role == CustomUser.Role.SUPERADMIN:
            user.is_staff = True
            user.is_superuser = True
            user.managed_by = None  # superadmins are not managed by anyone
        elif new_role == CustomUser.Role.ADMIN:
            user.is_staff = True
            user.is_superuser = False
            user.managed_by = None  # admins are not managed by other admins
        else:
            user.is_staff = False
            user.is_superuser = False
        user.save(update_fields=["role", "is_staff", "is_superuser", "managed_by"])
        return user


class AdminLockUserSerializer(serializers.Serializer):
    """
    Manually lock a user for a given number of minutes.
    lockout_minutes defaults to 30; max is 10 080 (1 week).
    """
    lockout_minutes = serializers.IntegerField(
        min_value=1, max_value=10_080, default=30
    )

    def save(self) -> CustomUser:
        from django.utils import timezone

        user: CustomUser = self.context["target_user"]
        minutes = self.validated_data["lockout_minutes"]
        user.locked_until = timezone.now() + timezone.timedelta(minutes=minutes)
        user.save(update_fields=["locked_until"])
        return user


class AdminInviteUserSerializer(serializers.Serializer):
    """
    Admin (or superadmin) invites a new user.
    The created user is automatically set as managed_by the inviting admin.
    Superadmin can optionally specify a different managed_by.
    """
    email = serializers.EmailField(max_length=254)
    password = serializers.CharField(write_only=True)
    password_confirm = serializers.CharField(write_only=True)
    managed_by_id = serializers.UUIDField(
        required=False,
        help_text="Superadmin only: assign to a specific admin. Omit to use yourself.",
    )

    def validate_email(self, value: str) -> str:
        value = value.lower().strip()
        requester: CustomUser = self.context["request"].user
        if CustomUser.objects.filter(email=value).exists():
            # Give admin a vague message so they cannot confirm whether an email exists
            if requester.is_admin:
                raise serializers.ValidationError(
                    "Unable to create account. Please use a different email address."
                )
            raise serializers.ValidationError("An account with this email already exists.")
        return value

    def validate_password(self, value: str) -> str:
        return validate_password_strength(value)

    def validate(self, attrs: dict) -> dict:
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError({"password_confirm": "Passwords do not match."})

        requester: CustomUser = self.context["request"].user

        # Resolve managed_by
        if "managed_by_id" in attrs:
            if not requester.is_superadmin:
                raise serializers.ValidationError(
                    {"managed_by_id": "Only superadmins can assign a different manager."}
                )
            try:
                manager = CustomUser.objects.get(
                    pk=attrs["managed_by_id"], role=CustomUser.Role.ADMIN, is_active=True
                )
            except CustomUser.DoesNotExist:
                raise serializers.ValidationError(
                    {"managed_by_id": "No active admin found with this ID."}
                )
            attrs["_manager"] = manager
        else:
            # Admin inviting → they manage this user
            # Superadmin inviting without specifying → no manager (orphan)
            attrs["_manager"] = requester if requester.is_admin else None

        return attrs

    def create(self, validated_data: dict) -> CustomUser:
        manager = validated_data.pop("_manager")
        validated_data.pop("password_confirm")
        validated_data.pop("managed_by_id", None)
        user = CustomUser.objects.create_user(
            email=validated_data["email"],
            password=validated_data["password"],
            role=CustomUser.Role.USER,
            managed_by=manager,
        )
        UserProfile.objects.create(user=user)
        return user


class AssignManagerSerializer(serializers.Serializer):
    """
    Superadmin assigns (or clears) a user's manager.
    Pass managed_by_id=null to un-assign.
    """
    managed_by_id = serializers.UUIDField(allow_null=True)

    def validate_managed_by_id(self, value):
        if value is None:
            return None
        try:
            return CustomUser.objects.get(
                pk=value, role=CustomUser.Role.ADMIN, is_active=True
            )
        except CustomUser.DoesNotExist:
            raise serializers.ValidationError("No active admin found with this ID.")

    def save(self) -> CustomUser:
        user: CustomUser = self.context["target_user"]
        manager = self.validated_data["managed_by_id"]  # already a CustomUser or None
        user.managed_by = manager
        user.save(update_fields=["managed_by"])
        return user


class AdminRegisterSerializer(serializers.Serializer):
    """
    Self-registration for an admin account.
    Creates the user with role=admin AND auto-creates their Organization.
    """
    email = serializers.EmailField(max_length=254)
    password = serializers.CharField(write_only=True)
    password_confirm = serializers.CharField(write_only=True)
    organization_name = serializers.CharField(max_length=200)

    def validate_email(self, value: str) -> str:
        value = value.lower().strip()
        existing = CustomUser.objects.filter(email=value).first()
        if existing:
            if existing.approval_status == CustomUser.ApprovalStatus.REJECTED:
                # Clean up the rejected account so the user can re-register fresh.
                existing.delete()
            else:
                raise serializers.ValidationError("An account with this email already exists.")
        return value

    def validate_password(self, value: str) -> str:
        return validate_password_strength(value)

    def validate(self, attrs: dict) -> dict:
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError({"password_confirm": "Passwords do not match."})
        return attrs

    def create(self, validated_data: dict) -> CustomUser:
        from apps.organizations.models import Organization, Plan

        validated_data.pop("password_confirm")
        org_name = validated_data.pop("organization_name")

        user = CustomUser.objects.create_user(
            email=validated_data["email"],
            password=validated_data["password"],
            role=CustomUser.Role.ADMIN,
            is_staff=True,
        )
        UserProfile.objects.create(user=user)

        free_plan = Plan.objects.filter(tier=Plan.Tier.FREE, is_active=True).first()
        if not free_plan:
            raise serializers.ValidationError("No active free plan found. Contact support.")

        Organization.objects.create(
            name=org_name,
            owner=user,
            plan=free_plan,
        )
        return user


class AssignCompanySerializer(serializers.Serializer):
    """
    Admin or superadmin assigns a company to a user.
    - Superadmin: can assign any company to any user.
    - Admin: can only assign a company they manage, and only to their own managed users.
    Pass company_id=null to remove the association.
    """
    company_id = serializers.UUIDField(allow_null=True)

    def validate_company_id(self, value):
        if value is None:
            return None
        from apps.company.models import Company
        try:
            company = Company.objects.get(pk=value)
        except Company.DoesNotExist:
            raise serializers.ValidationError("Company not found.")

        requester = self.context["request"].user
        # Admin can only assign companies they are the manager of
        if requester.is_admin and company.managed_by_id != requester.id:
            raise serializers.ValidationError(
                "You can only assign companies you manage."
            )
        return company

    def validate(self, attrs):
        requester = self.context["request"].user
        target: CustomUser = self.context["target_user"]

        # Admin can only assign to users they manage
        if requester.is_admin and target.managed_by_id != requester.id:
            raise serializers.ValidationError(
                "You can only assign companies to users you manage."
            )
        return attrs

    def save(self) -> CustomUser:
        user: CustomUser = self.context["target_user"]
        user.company = self.validated_data["company_id"]  # Company instance or None
        user.save(update_fields=["company"])
        return user


# ── Invite-link flow serializers ──────────────────────────────────────────────

class SendInviteSerializer(serializers.Serializer):
    """
    Admin sends an invite to an email address only — no password required.
    Superadmin can optionally specify which admin will manage the invited user.
    """
    email = serializers.EmailField(max_length=254)
    managed_by_id = serializers.UUIDField(
        required=False,
        allow_null=True,
        help_text="Superadmin only: assign to a specific admin.",
    )

    def validate_email(self, value: str) -> str:
        value = value.lower().strip()
        if CustomUser.objects.filter(email=value).exists():
            raise serializers.ValidationError(
                "An account with this email already exists."
            )
        return value

    def validate(self, attrs: dict) -> dict:
        requester: CustomUser = self.context["request"].user
        managed_by_id = attrs.get("managed_by_id")

        if managed_by_id:
            if not requester.is_superadmin:
                raise serializers.ValidationError(
                    {"managed_by_id": "Only superadmins can assign a different manager."}
                )
            try:
                manager = CustomUser.objects.get(
                    pk=managed_by_id, role=CustomUser.Role.ADMIN, is_active=True
                )
            except CustomUser.DoesNotExist:
                raise serializers.ValidationError(
                    {"managed_by_id": "No active admin found with this ID."}
                )
            attrs["_manager"] = manager
        else:
            attrs["_manager"] = requester if requester.is_admin else None

        return attrs


class CompleteInviteSerializer(serializers.Serializer):
    """
    Submitted by the invited user to complete their account setup.
    """
    token = serializers.UUIDField()
    first_name = serializers.CharField(max_length=100)
    last_name = serializers.CharField(max_length=100)
    phone = serializers.CharField(max_length=20, required=False, allow_blank=True)
    password = serializers.CharField(write_only=True)
    password_confirm = serializers.CharField(write_only=True)

    def validate_password(self, value: str) -> str:
        return validate_password_strength(value)

    def validate(self, attrs: dict) -> dict:
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError({"password_confirm": "Passwords do not match."})

        try:
            invite = InviteToken.objects.select_related("invited_by", "managed_by").get(
                token=attrs["token"]
            )
        except InviteToken.DoesNotExist:
            raise serializers.ValidationError({"token": "Invalid invite link."})

        if invite.is_used:
            raise serializers.ValidationError({"token": "This invite link has already been used."})
        if invite.is_expired:
            raise serializers.ValidationError({"token": "This invite link has expired."})

        attrs["_invite"] = invite
        return attrs

    def save(self) -> CustomUser:
        invite: InviteToken = self.validated_data["_invite"]

        is_admin_invite = invite.invited_role == CustomUser.Role.ADMIN
        user = CustomUser.objects.create_user(
            email=invite.email,
            password=self.validated_data["password"],
            role=invite.invited_role,
            managed_by=invite.managed_by,
            is_staff=is_admin_invite,
            is_verified=False,
            is_active=True,
        )
        UserProfile.objects.create(
            user=user,
            first_name=self.validated_data["first_name"],
            last_name=self.validated_data["last_name"],
            phone=self.validated_data.get("phone", ""),
        )

        invite.is_used = True
        invite.save(update_fields=["is_used"])
        return user


class VerifyOTPSerializer(serializers.Serializer):
    """Verifies the 6-digit OTP sent after invite signup completion."""
    email = serializers.EmailField()
    otp_code = serializers.CharField(max_length=6, min_length=6)

    def validate(self, attrs: dict) -> dict:
        email = attrs["email"].lower().strip()
        try:
            user = CustomUser.objects.get(email=email, is_active=True)
        except CustomUser.DoesNotExist:
            raise serializers.ValidationError({"email": "No account found with this email."})

        if user.is_verified:
            raise serializers.ValidationError({"email": "This account is already verified."})

        otp = (
            OTPCode.objects
            .filter(user=user, is_used=False)
            .order_by("-created_at")
            .first()
        )
        if otp is None:
            raise serializers.ValidationError({"otp_code": "No OTP found. Please request a new one."})
        if otp.is_expired:
            raise serializers.ValidationError({"otp_code": "OTP has expired. Please request a new one."})
        if otp.code != attrs["otp_code"]:
            raise serializers.ValidationError({"otp_code": "Incorrect OTP code."})

        attrs["_user"] = user
        attrs["_otp"] = otp
        return attrs

    def save(self) -> CustomUser:
        user: CustomUser = self.validated_data["_user"]
        otp: OTPCode = self.validated_data["_otp"]
        otp.is_used = True
        otp.save(update_fields=["is_used"])
        user.is_verified = True
        user.save(update_fields=["is_verified"])
        return user
