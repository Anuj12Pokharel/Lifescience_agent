from datetime import timedelta

import datetime

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema, inline_serializer
from rest_framework import serializers as drf_serializers, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import CustomUser, InviteToken
from apps.accounts.serializers import (
    AdminInviteUserSerializer,
    AdminLockUserSerializer,
    AdminRegisterSerializer,
    AdminUpdateRoleSerializer,
    AdminUserDetailSerializer,
    AdminUserListSerializer,
    AssignCompanySerializer,
    AssignManagerSerializer,
    ChangePasswordSerializer,
    CompleteInviteSerializer,
    ForgotPasswordSerializer,
    LoginSerializer,
    LogoutSerializer,
    RegisterSerializer,
    ResetPasswordSerializer,
    SendInviteSerializer,
    UserSerializer,
    VerifyEmailSerializer,
    VerifyOTPSerializer,
    email_verification_token,
)
from apps.accounts.permissions import IsAdminOrSuperAdmin, IsSuperAdmin
from apps.core.pagination import StandardResultsSetPagination


# ── Helpers ───────────────────────────────────────────────────────────────────

def _success(data=None, message: str = "", status_code: int = status.HTTP_200_OK) -> Response:
    body: dict = {"success": True}
    if message:
        body["message"] = message
    if data is not None:
        body["data"] = data
    return Response(body, status=status_code)


def _refresh_cookie_kwargs() -> dict:
    lifetime: timedelta = getattr(settings, "SIMPLE_JWT", {}).get(
        "REFRESH_TOKEN_LIFETIME", timedelta(days=7)
    )
    return {
        "key": "refresh_token",
        "httponly": True,
        "secure": not settings.DEBUG,
        "samesite": "Lax",
        "path": "/api/v1/auth/",
        "max_age": int(lifetime.total_seconds()),
    }


def _send_html_email(
    subject: str,
    template: str,
    context: dict,
    recipient: str,
) -> None:
    """Send an HTML email with a plain-text fallback."""
    context.setdefault("app_name", getattr(settings, "APP_NAME", "Neural Codex"))
    context.setdefault("year", datetime.datetime.now().year)

    html_body = render_to_string(template, context)

    plain_body = (
        f"{context.get('app_name')}\n\n"
        f"{subject}\n\n"
        f"Open the link below in your browser:\n"
        f"{context.get('verify_url') or context.get('reset_url', '')}\n\n"
        f"If you did not request this, please ignore this email.\n"
        f"© {context.get('year')} {context.get('app_name')}"
    )

    email = EmailMultiAlternatives(
        subject=subject,
        body=plain_body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[recipient],
    )
    email.attach_alternative(html_body, "text/html")
    email.send(fail_silently=True)


def _frontend_url() -> str:
    return getattr(settings, "FRONTEND_URL", "http://localhost:3000").rstrip("/")


def _get_user_or_404(pk) -> CustomUser:
    from rest_framework.exceptions import NotFound
    try:
        return CustomUser.objects.select_related("profile", "managed_by").get(pk=pk)
    except CustomUser.DoesNotExist:
        raise NotFound("User not found.")


def _guard_self(request_user: CustomUser, target: CustomUser, action: str) -> None:
    if request_user == target:
        raise PermissionDenied(f"You cannot {action} your own account.")


def _check_admin_scope(requester: CustomUser, target: CustomUser) -> None:
    """
    If the requester is an admin (not superadmin), verify they manage the target.
    Raises PermissionDenied otherwise.
    """
    if requester.is_superadmin:
        return
    if target.managed_by_id != requester.id:
        raise PermissionDenied("You can only manage users assigned to you.")


# ── Views ─────────────────────────────────────────────────────────────────────

class RegisterView(APIView):
    """Kept for admin self-registration email verification dispatch only. Direct user signup is disabled."""
    permission_classes = [AllowAny]

    def post(self, request: Request) -> Response:
        return Response(
            {"success": False, "error": {"code": "REGISTRATION_DISABLED",
             "message": "Self-registration is disabled. Please use an invite link sent by your administrator.",
             "details": {}}},
            status=status.HTTP_403_FORBIDDEN,
        )

    @staticmethod
    def _dispatch_verification_email(user: CustomUser) -> None:
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = email_verification_token.make_token(user)
        verify_url = f"{_frontend_url()}/verify-email?uid={uid}&token={token}"
        _send_html_email(
            subject="Verify your email address",
            template="emails/verify_email.html",
            context={"verify_url": verify_url},
            recipient=user.email,
        )


class LoginView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(
        tags=["Auth"],
        summary="Login and obtain tokens",
        request=LoginSerializer,
        responses={
            200: OpenApiResponse(description="Access token in body, refresh token in httpOnly cookie."),
            401: OpenApiResponse(description="Invalid credentials or account locked"),
        },
    )
    def post(self, request: Request) -> Response:
        serializer = LoginSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)

        user: CustomUser = serializer.validated_data["user"]
        refresh = RefreshToken.for_user(user)

        response = _success(
            data={
                "access": str(refresh.access_token),
                "token_type": "Bearer",
                "user": UserSerializer(user).data,
            },
            message="Login successful.",
        )
        cookie_kwargs = _refresh_cookie_kwargs()
        response.set_cookie(value=str(refresh), **cookie_kwargs)
        return response


class TokenRefreshCookieView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(
        tags=["Auth"],
        summary="Refresh access token",
        request=inline_serializer(
            name="TokenRefreshRequest",
            fields={"refresh": drf_serializers.CharField(required=False, help_text="Omit if using httpOnly cookie")},
        ),
        responses={
            200: OpenApiResponse(description="New access token"),
            401: OpenApiResponse(description="Refresh token invalid or expired"),
        },
    )
    def post(self, request: Request) -> Response:
        refresh_token = request.COOKIES.get("refresh_token") or request.data.get("refresh")

        if not refresh_token:
            return Response(
                {"success": False, "error": {"code": "MISSING_TOKEN", "message": "Refresh token is required.", "details": {}}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            refresh = RefreshToken(refresh_token)
            new_access = str(refresh.access_token)

            rotate = getattr(settings, "SIMPLE_JWT", {}).get("ROTATE_REFRESH_TOKENS", False)
            response = _success(
                data={"access": new_access, "token_type": "Bearer"},
                message="Token refreshed.",
            )
            if rotate:
                refresh.blacklist()
                new_refresh = RefreshToken.for_user(
                    CustomUser.objects.get(pk=refresh["user_id"])
                )
                cookie_kwargs = _refresh_cookie_kwargs()
                response.set_cookie(value=str(new_refresh), **cookie_kwargs)

            return response

        except TokenError as exc:
            return Response(
                {"success": False, "error": {"code": "TOKEN_INVALID", "message": str(exc), "details": {}}},
                status=status.HTTP_401_UNAUTHORIZED,
            )


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Auth"],
        summary="Logout and blacklist refresh token",
        request=inline_serializer(
            name="LogoutRequest",
            fields={"refresh": drf_serializers.CharField(required=False, help_text="Omit if using httpOnly cookie")},
        ),
        responses={
            200: OpenApiResponse(description="Logged out successfully"),
            400: OpenApiResponse(description="Missing refresh token"),
        },
    )
    def post(self, request: Request) -> Response:
        refresh_token = request.COOKIES.get("refresh_token") or request.data.get("refresh")

        if not refresh_token:
            return Response(
                {"success": False, "error": {"code": "MISSING_TOKEN", "message": "Refresh token is required to log out.", "details": {}}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
        except TokenError:
            pass

        response = _success(message="You have been logged out successfully.")
        response.delete_cookie("refresh_token", path="/api/v1/auth/")
        return response


class ForgotPasswordView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(
        tags=["Auth"],
        summary="Request a password reset email",
        request=ForgotPasswordSerializer,
        responses={200: OpenApiResponse(description="Reset email sent (if account exists)")},
    )
    def post(self, request: Request) -> Response:
        serializer = ForgotPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        uid, token = serializer.get_token_data()
        if uid and token:
            email = serializer.validated_data["email"]
            self._dispatch_reset_email(email, uid, token)

        return _success(
            message=(
                "If an account with that email address exists, "
                "a password reset link has been sent."
            )
        )

    @staticmethod
    def _dispatch_reset_email(email: str, uid: str, token: str) -> None:
        reset_url = f"{_frontend_url()}/reset-password?uid={uid}&token={token}"
        _send_html_email(
            subject="Reset your password",
            template="emails/reset_password.html",
            context={"reset_url": reset_url},
            recipient=email,
        )


class ResetPasswordView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(
        tags=["Auth"],
        summary="Reset password using uid + token from email",
        request=ResetPasswordSerializer,
        responses={
            200: OpenApiResponse(description="Password reset successful"),
            422: OpenApiResponse(description="Invalid or expired token"),
        },
    )
    def post(self, request: Request) -> Response:
        serializer = ResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return _success(
            message="Password reset successful. You can now log in with your new password."
        )


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Auth"],
        summary="Change password (authenticated)",
        request=ChangePasswordSerializer,
        responses={
            200: OpenApiResponse(description="Password changed, new access token returned"),
            422: OpenApiResponse(description="Current password incorrect or validation error"),
        },
    )
    def post(self, request: Request) -> Response:
        serializer = ChangePasswordSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()

        refresh = RefreshToken.for_user(request.user)
        response = _success(
            data={"access": str(refresh.access_token), "token_type": "Bearer"},
            message="Password changed successfully.",
        )
        cookie_kwargs = _refresh_cookie_kwargs()
        response.set_cookie(value=str(refresh), **cookie_kwargs)
        return response


class VerifyEmailView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(
        tags=["Auth"],
        summary="Verify email address",
        request=VerifyEmailSerializer,
        responses={
            200: OpenApiResponse(description="Email verified"),
            422: OpenApiResponse(description="Invalid or expired verification link"),
        },
    )
    def post(self, request: Request) -> Response:
        serializer = VerifyEmailSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return _success(message="Email verified successfully. You can now log in.")


class ResendVerificationView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(
        tags=["Auth"],
        summary="Resend email verification link",
        request=inline_serializer(
            name="ResendVerificationRequest",
            fields={"email": drf_serializers.EmailField()},
        ),
        responses={200: OpenApiResponse(description="Verification email sent (if unverified account exists)")},
    )
    def post(self, request: Request) -> Response:
        email = (request.data.get("email") or "").lower().strip()

        if email:
            try:
                user = CustomUser.objects.get(email=email, is_active=True)
                if not user.is_verified:
                    RegisterView._dispatch_verification_email(user)
            except CustomUser.DoesNotExist:
                pass

        return _success(
            message=(
                "If an unverified account with that email exists, "
                "a new verification email has been sent."
            )
        )


# ── SuperAdmin + Admin: user management ───────────────────────────────────────

class UserListView(APIView):
    """
    GET /api/v1/users/
    - Superadmin: sees ALL users
    - Admin: sees only users where managed_by = request.user
    """
    permission_classes = [IsAuthenticated, IsAdminOrSuperAdmin]

    @extend_schema(
        tags=["Admin — Users"],
        summary="List users",
        parameters=[
            OpenApiParameter("role", str, description="Filter by role (superadmin only)"),
            OpenApiParameter("is_active", bool, description="Filter by active status"),
            OpenApiParameter("is_verified", bool, description="Filter by verified status"),
            OpenApiParameter("search", str, description="Search by email (superadmin only)"),
            OpenApiParameter("page", int, description="Page number"),
            OpenApiParameter("page_size", int, description="Results per page"),
        ],
        responses={200: AdminUserListSerializer(many=True)},
    )
    def get(self, request: Request) -> Response:
        if request.user.is_superadmin:
            qs = CustomUser.objects.select_related("profile", "managed_by").order_by("-date_joined")

            # Superadmin-only filters
            role = request.query_params.get("role")
            search = request.query_params.get("search", "").strip()
            if role:
                qs = qs.filter(role=role)
            if search:
                qs = qs.filter(email__icontains=search)
        else:
            # Admin: sees users they manage
            qs = CustomUser.objects.select_related("profile", "managed_by").filter(
                managed_by=request.user
            ).order_by("-date_joined")

            search = request.query_params.get("search", "").strip()
            if search:
                qs = qs.filter(email__icontains=search)

        is_active = request.query_params.get("is_active")
        is_verified = request.query_params.get("is_verified")

        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() == "true")
        if is_verified is not None:
            qs = qs.filter(is_verified=is_verified.lower() == "true")

        paginator = StandardResultsSetPagination()
        page = paginator.paginate_queryset(qs, request)
        return paginator.get_paginated_response(
            AdminUserListSerializer(page, many=True).data
        )


class UserDetailView(APIView):
    """
    GET /api/v1/users/<pk>/
    - Superadmin: any user
    - Admin: only their managed users
    """
    permission_classes = [IsAuthenticated, IsAdminOrSuperAdmin]

    @extend_schema(
        tags=["Admin — Users"],
        summary="Get user detail",
        responses={200: AdminUserDetailSerializer},
    )
    def get(self, request: Request, pk) -> Response:
        user = _get_user_or_404(pk)
        _check_admin_scope(request.user, user)
        return _success(data=AdminUserDetailSerializer(user).data)


class UserUpdateRoleView(APIView):
    """
    PATCH /api/v1/users/<pk>/role/
    Superadmin only — admins cannot change roles.
    """
    permission_classes = [IsAuthenticated, IsSuperAdmin]

    @extend_schema(
        tags=["Admin — Users"],
        summary="Update user role (superadmin only)",
        request=AdminUpdateRoleSerializer,
        responses={200: AdminUserDetailSerializer},
    )
    def patch(self, request: Request, pk) -> Response:
        target = _get_user_or_404(pk)
        serializer = AdminUpdateRoleSerializer(
            data=request.data,
            context={"request": request, "target_user": target},
        )
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return _success(
            data=AdminUserDetailSerializer(user).data,
            message=f"Role updated to '{user.get_role_display()}'.",
        )


class UserActivateView(APIView):
    permission_classes = [IsAuthenticated, IsAdminOrSuperAdmin]

    @extend_schema(
        tags=["Admin — Users"],
        summary="Activate a user account",
        request=None,
        responses={200: OpenApiResponse(description="User activated")},
    )
    def post(self, request: Request, pk) -> Response:
        user = _get_user_or_404(pk)
        _guard_self(request.user, user, "modify the active status of")
        _check_admin_scope(request.user, user)

        if user.is_active:
            return _success(message=f"{user.email} is already active.")

        user.is_active = True
        user.save(update_fields=["is_active"])
        return _success(message=f"{user.email} has been activated.")


class UserDeactivateView(APIView):
    permission_classes = [IsAuthenticated, IsAdminOrSuperAdmin]

    @extend_schema(
        tags=["Admin — Users"],
        summary="Deactivate a user account",
        request=None,
        responses={200: OpenApiResponse(description="User deactivated")},
    )
    def post(self, request: Request, pk) -> Response:
        user = _get_user_or_404(pk)
        _guard_self(request.user, user, "deactivate")
        _check_admin_scope(request.user, user)

        if not user.is_active:
            return _success(message=f"{user.email} is already inactive.")

        user.is_active = False
        user.save(update_fields=["is_active"])
        return _success(message=f"{user.email} has been deactivated.")


class UserLockView(APIView):
    permission_classes = [IsAuthenticated, IsAdminOrSuperAdmin]

    @extend_schema(
        tags=["Admin — Users"],
        summary="Manually lock a user account",
        request=AdminLockUserSerializer,
        responses={200: OpenApiResponse(description="User locked")},
    )
    def post(self, request: Request, pk) -> Response:
        user = _get_user_or_404(pk)
        _guard_self(request.user, user, "lock")
        _check_admin_scope(request.user, user)

        serializer = AdminLockUserSerializer(
            data=request.data,
            context={"target_user": user},
        )
        serializer.is_valid(raise_exception=True)
        updated_user = serializer.save()
        return _success(
            data={
                "id": str(updated_user.id),
                "email": updated_user.email,
                "locked_until": updated_user.locked_until,
            },
            message=f"{updated_user.email} has been locked until {updated_user.locked_until.strftime('%Y-%m-%d %H:%M UTC')}.",
        )


class UserUnlockView(APIView):
    permission_classes = [IsAuthenticated, IsAdminOrSuperAdmin]

    @extend_schema(
        tags=["Admin — Users"],
        summary="Unlock a user account",
        request=None,
        responses={200: OpenApiResponse(description="User unlocked")},
    )
    def post(self, request: Request, pk) -> Response:
        user = _get_user_or_404(pk)
        _check_admin_scope(request.user, user)

        if not user.is_locked and user.failed_login_attempts == 0:
            return _success(message=f"{user.email} is not locked.")

        user.reset_failed_login()
        return _success(message=f"{user.email} has been unlocked.")


class AdminInviteUserView(APIView):
    """
    POST /api/v1/users/invite/

    Admin or Superadmin sends an invite email to a given address.
    No user is created yet — the invited person completes signup via the link.
    - Admin inviting: managed_by = admin. Invited role = USER.
    - Superadmin inviting: can specify managed_by_id. Invited role = USER by default.
    """
    permission_classes = [IsAuthenticated, IsAdminOrSuperAdmin]

    def post(self, request: Request) -> Response:
        from django.utils import timezone as tz
        from apps.accounts.models import InviteToken

        serializer = SendInviteSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)

        email: str = serializer.validated_data["email"]
        manager: CustomUser | None = serializer.validated_data["_manager"]

        # Invalidate any prior unused invites for this email
        InviteToken.objects.filter(email=email, is_used=False).update(is_used=True)

        invite = InviteToken.objects.create(
            email=email,
            invited_role=CustomUser.Role.USER,
            invited_by=request.user,
            managed_by=manager,
            expires_at=tz.now() + tz.timedelta(hours=72),
        )

        invite_url = f"{_frontend_url()}/invite/{invite.token}"
        app_name = getattr(settings, "APP_NAME", "Life Science AI")
        org_name = getattr(getattr(request.user, "owned_organization", None), "name", None) or app_name

        try:
            # ── Prefer admin's connected Gmail over server SMTP ───────────────
            from apps.integrations.gmail_sender import get_org_gmail_credential, send_via_gmail
            from django.template.loader import render_to_string

            gmail_cred = None
            try:
                admin_org = request.user.owned_organization
                gmail_cred = get_org_gmail_credential(admin_org)
            except Exception:
                pass

            email_ctx = {
                "email": email,
                "invited_by": request.user.email,
                "org_name": org_name,
                "invite_url": invite_url,
                "expires_hours": 72,
            }

            if gmail_cred:
                html_body = render_to_string("emails/invite_link.html", email_ctx)
                send_via_gmail(
                    credential=gmail_cred,
                    to=email,
                    subject=f"{org_name} has invited you to {app_name}",
                    html_body=html_body,
                )
            else:
                _send_html_email(
                    subject=f"{org_name} has invited you to {app_name}",
                    template="emails/invite_link.html",
                    context=email_ctx,
                    recipient=email,
                )
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"Failed to send invite email: {str(e)}")
            return Response(
                {"success": False, "error": {"message": f"Could not send email. Please check SMTP settings. Error: {str(e)}", "details": {}}},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


        return _success(
            data={"email": email, "invite_token": str(invite.token)},
            message=f"Invite sent to '{email}'. Link expires in 72 hours.",
            status_code=status.HTTP_201_CREATED,
        )


class ValidateInviteTokenView(APIView):
    """
    GET /api/v1/auth/invite/validate/?token=<uuid>

    Returns the invite details (email, invited_by) if the token is valid.
    Used by the frontend signup form to pre-fill email.
    """
    permission_classes = [AllowAny]

    def get(self, request: Request) -> Response:
        from apps.accounts.models import InviteToken

        token = request.query_params.get("token", "").strip()
        if not token:
            return Response(
                {"success": False, "error": {"message": "token is required.", "details": {}}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            invite = InviteToken.objects.select_related("invited_by").get(token=token)
        except (InviteToken.DoesNotExist, Exception):
            return Response(
                {"success": False, "error": {"message": "Invalid invite link.", "details": {}}},
                status=status.HTTP_404_NOT_FOUND,
            )

        if invite.is_used:
            return Response(
                {"success": False, "error": {"message": "This invite link has already been used.", "details": {}}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if invite.is_expired:
            return Response(
                {"success": False, "error": {"message": "This invite link has expired.", "details": {}}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return _success(data={
            "email": invite.email,
            "invited_by": invite.invited_by.email,
            "expires_at": invite.expires_at.isoformat(),
        })


class CompleteInviteView(APIView):
    """
    POST /api/v1/auth/invite/complete/

    Accepts the invite token + user form data, creates the user, sends an OTP.
    """
    permission_classes = [AllowAny]

    def post(self, request: Request) -> Response:
        serializer = CompleteInviteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user: CustomUser = serializer.save()

<<<<<<< HEAD
        # Generate and store OTP
        code = OTPCode.generate_code()
        OTPCode.objects.create(
            user=user,
            code=code,
            expires_at=tz.now() + tz.timedelta(minutes=15),
        )

        try:
            _send_html_email(
                subject="Your verification code",
                template="emails/otp_verification.html",
                context={
                    "otp_code": code,
                    "email": user.email,
                    "expires_minutes": 15,
                },
                recipient=user.email,
            )
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"Failed to send OTP email: {str(e)}")
            # We still return success since the user was created, but we could warn them.
=======
        # Auto-verify invited users — no OTP needed
        user.is_verified = True
        user.save(update_fields=["is_verified"])
>>>>>>> 77d4611a92cd9de88db8272f414f06b767b34fe1

        return _success(
            data={"email": user.email},
            message="Account created successfully. You can now sign in.",
            status_code=status.HTTP_201_CREATED,
        )


class VerifyOTPView(APIView):
    """
    POST /api/v1/auth/verify-otp/

    Verifies the OTP. On success the user is marked as verified and can log in.
    """
    permission_classes = [AllowAny]

    def post(self, request: Request) -> Response:
        serializer = VerifyOTPSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return _success(message="Email verified successfully. You can now sign in.")


class ResendOTPView(APIView):
    """
    POST /api/v1/auth/resend-otp/

    Generates a fresh OTP and resends it to the user's email.
    """
    permission_classes = [AllowAny]

    def post(self, request: Request) -> Response:
        from django.utils import timezone as tz
        from apps.accounts.models import OTPCode

        email = (request.data.get("email") or "").lower().strip()
        if not email:
            return Response(
                {"success": False, "error": {"message": "email is required.", "details": {}}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            user = CustomUser.objects.get(email=email, is_active=True)
        except CustomUser.DoesNotExist:
            # Silent — don't reveal account existence
            return _success(message="If an unverified account exists, a new code has been sent.")

        if user.is_verified:
            return _success(message="This account is already verified.")

        # Invalidate old OTPs
        OTPCode.objects.filter(user=user, is_used=False).update(is_used=True)

        code = OTPCode.generate_code()
        OTPCode.objects.create(
            user=user,
            code=code,
            expires_at=tz.now() + tz.timedelta(minutes=15),
        )

        try:
            _send_html_email(
                subject="Your new verification code",
                template="emails/otp_verification.html",
                context={"otp_code": code, "email": user.email, "expires_minutes": 15},
                recipient=user.email,
            )
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"Failed to resend OTP email: {str(e)}")
            return Response(
                {"success": False, "error": {"message": f"Could not send email. Please check SMTP settings. Error: {str(e)}", "details": {}}},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        return _success(message="A new verification code has been sent to your email.")


class MyGrantedAgentsView(APIView):
    """
    GET /api/v1/users/my-agents/

    For admins: returns all agents superadmin has granted to them directly.
    Shows grant details + how many of their users/groups already have access.
    Superadmin sees all agents.
    """
    permission_classes = [IsAuthenticated, IsAdminOrSuperAdmin]

    def get(self, request: Request) -> Response:
        from apps.agents.models import Agent, UserAgentAccess
        from apps.agents.group_models import AgentGroupAccess

        if request.user.is_superadmin:
            # Superadmin sees all agents
            agents = Agent.objects.all().order_by("name")
            results = []
            for agent in agents:
                results.append({
                    "agent_id": str(agent.id),
                    "name": agent.name,
                    "subtitle": agent.subtitle,
                    "description": agent.description,
                    "slug": agent.slug,
                    "agent_type": agent.agent_type,
                    "status": agent.status,
                    "latency": agent.latency,
                    "efficiency": agent.efficiency,
                    "is_active": agent.is_active,
                    "granted_by": None,
                    "granted_at": None,
                    "expires_at": None,
                })
        else:
            # Admin: only agents directly granted to them
            accesses = (
                UserAgentAccess.objects
                .filter(user=request.user, is_active=True)
                .select_related("agent", "granted_by")
                .order_by("agent__name")
            )
            results = []
            for access in accesses:
                agent = access.agent
                # Count how many of this admin's managed users have access to this agent
                users_with_access = UserAgentAccess.objects.filter(
                    user__managed_by=request.user,
                    agent=agent,
                    is_active=True,
                ).count()
                # Count how many of this admin's groups have this agent assigned
                groups_with_access = AgentGroupAccess.objects.filter(
                    group__created_by=request.user,
                    agent=agent,
                    is_active=True,
                ).count()
                results.append({
                    "agent_id": str(agent.id),
                    "name": agent.name,
                    "subtitle": agent.subtitle,
                    "description": agent.description,
                    "slug": agent.slug,
                    "agent_type": agent.agent_type,
                    "status": agent.status,
                    "latency": agent.latency,
                    "efficiency": agent.efficiency,
                    "is_active": agent.is_active,
                    "is_expired": access.is_expired,
                    "granted_by": access.granted_by.email if access.granted_by else None,
                    "granted_at": access.created_at,
                    "expires_at": access.expires_at,
                    "assigned_to_users": users_with_access,
                    "assigned_to_groups": groups_with_access,
                })

        paginator = StandardResultsSetPagination()
        page = paginator.paginate_queryset(results, request)
        return paginator.get_paginated_response(page)


class AssignManagerView(APIView):
    """
    PATCH /api/v1/users/<pk>/assign-manager/

    Superadmin assigns (or removes) an admin as manager for a user.
    Body: { "managed_by_id": "<admin_uuid>" }  or  { "managed_by_id": null }
    """
    permission_classes = [IsAuthenticated, IsSuperAdmin]

    def patch(self, request: Request, pk) -> Response:
        target = _get_user_or_404(pk)

        if target.role != CustomUser.Role.USER:
            return Response(
                {"success": False, "error": {"code": "INVALID_OPERATION", "message": "Only regular users can be assigned to an admin.", "details": {}}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = AssignManagerSerializer(
            data=request.data, context={"target_user": target}
        )
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        manager = user.managed_by
        msg = (
            f"{user.email} assigned to admin '{manager.email}'."
            if manager else
            f"{user.email} unassigned from any admin."
        )
        return _success(data=AdminUserDetailSerializer(user).data, message=msg)


# ── Admin / SuperAdmin: assign company to user ────────────────────────────────

class AssignCompanyView(APIView):
    """
    PATCH /api/v1/users/<pk>/assign-company/

    Assigns (or removes) a company from a user.
    - Superadmin: any company → any user.
    - Admin: only their managed company → only their managed users.
    Body: { "company_id": "<company_uuid>" }  or  { "company_id": null }
    """
    permission_classes = [IsAuthenticated, IsAdminOrSuperAdmin]

    def patch(self, request: Request, pk) -> Response:
        target = _get_user_or_404(pk)
        serializer = AssignCompanySerializer(
            data=request.data,
            context={"request": request, "target_user": target},
        )
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        company = user.company
        msg = (
            f"{user.email} assigned to company '{company.name}'."
            if company else
            f"{user.email} removed from any company."
        )
        return _success(data=AdminUserDetailSerializer(user).data, message=msg)


# ── SuperAdmin + Admin: per-user agent access management ─────────────────────

class UserAgentListView(APIView):
    """
    GET /api/v1/users/<pk>/agents/
    Shows every agent alongside this user's access status.
    Admin: can only view agents for their managed users.
    """
    permission_classes = [IsAuthenticated, IsAdminOrSuperAdmin]

    def get(self, request: Request, pk) -> Response:
        from apps.agents.models import Agent, UserAgentAccess

        user = _get_user_or_404(pk)
        _check_admin_scope(request.user, user)

        # Superadmin sees all agents; admin sees only agents they have access to
        if request.user.is_superadmin:
            all_agents = Agent.objects.all().order_by("name")
        else:
            all_agents = Agent.objects.filter(
                user_accesses__user=request.user,
                user_accesses__is_active=True,
            ).order_by("name")

        access_map = {
            a.agent_id: a
            for a in UserAgentAccess.objects.filter(user=user).select_related("agent")
        }

        results = []
        for agent in all_agents:
            access = access_map.get(agent.id)
            results.append({
                "agent_id": str(agent.id),
                "name": agent.name,
                "description": agent.description,
                "slug": agent.slug,
                "agent_type": agent.agent_type,
                "agent_is_active": agent.is_active,
                "has_access": access is not None,
                "access_is_active": access.is_active if access else False,
                "access_is_expired": access.is_expired if access else False,
                "expires_at": access.expires_at if access else None,
                "granted_by": (
                    str(access.granted_by.email) if access and access.granted_by else None
                ),
            })

        return _success(
            data={
                "user": {"id": str(user.id), "email": user.email},
                "agents": results,
            }
        )


class UserAgentGrantView(APIView):
    """
    POST /api/v1/users/<pk>/agents/grant/
    Grant a user access to an agent.
    Admin: can only grant to their managed users and only with agents they have access to.
    """
    permission_classes = [IsAuthenticated, IsAdminOrSuperAdmin]

    def post(self, request: Request, pk) -> Response:
        from apps.agents.models import Agent, UserAgentAccess

        user = _get_user_or_404(pk)
        _check_admin_scope(request.user, user)

        agent_id = request.data.get("agent_id")
        expires_at = request.data.get("expires_at")

        if not agent_id:
            return Response(
                {"success": False, "error": {"code": "VALIDATION_ERROR", "message": "agent_id is required.", "details": {}}},
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )

        try:
            agent = Agent.objects.get(pk=agent_id)
        except Agent.DoesNotExist:
            return Response(
                {"success": False, "error": {"code": "NOT_FOUND", "message": "Agent not found.", "details": {}}},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Admin can only grant agents they themselves have access to
        if request.user.is_admin:
            has_own_access = UserAgentAccess.objects.filter(
                user=request.user, agent=agent, is_active=True
            ).exists()
            if not has_own_access:
                return Response(
                    {"success": False, "error": {"code": "FORBIDDEN", "message": "You can only grant agents you have access to.", "details": {}}},
                    status=status.HTTP_403_FORBIDDEN,
                )

        access, created = UserAgentAccess.objects.update_or_create(
            user=user,
            agent=agent,
            defaults={
                "granted_by": request.user,
                "is_active": True,
                "expires_at": expires_at or None,
            },
        )

        action = "granted" if created else "updated"
        return _success(
            data={
                "agent_id": str(agent.id),
                "agent_name": agent.name,
                "user_email": user.email,
                "is_active": access.is_active,
                "expires_at": access.expires_at,
            },
            message=f"Access {action} for {user.email} to '{agent.name}'.",
            status_code=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class UserAgentToggleView(APIView):
    """
    POST /api/v1/users/<pk>/agents/<agent_id>/toggle/
    Toggle agent access for a user.
    Admin: only for their managed users and only agents they have access to.
    """
    permission_classes = [IsAuthenticated, IsAdminOrSuperAdmin]

    def post(self, request: Request, pk, agent_id) -> Response:
        from apps.agents.models import Agent, UserAgentAccess

        user = _get_user_or_404(pk)
        _check_admin_scope(request.user, user)

        try:
            agent = Agent.objects.get(pk=agent_id)
        except Agent.DoesNotExist:
            return Response(
                {"success": False, "error": {"code": "NOT_FOUND", "message": "Agent not found.", "details": {}}},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Admin can only toggle agents they themselves have access to
        if request.user.is_admin:
            has_own_access = UserAgentAccess.objects.filter(
                user=request.user, agent=agent, is_active=True
            ).exists()
            if not has_own_access:
                return Response(
                    {"success": False, "error": {"code": "FORBIDDEN", "message": "You can only manage agents you have access to.", "details": {}}},
                    status=status.HTTP_403_FORBIDDEN,
                )

        access, created = UserAgentAccess.objects.get_or_create(
            user=user,
            agent=agent,
            defaults={"granted_by": request.user, "is_active": True},
        )

        if not created:
            access.is_active = not access.is_active
            if access.is_active:
                access.granted_by = request.user
            access.save(update_fields=["is_active", "granted_by", "updated_at"])

        state = "activated" if access.is_active else "deactivated"
        return _success(
            data={
                "agent_id": str(agent.id),
                "agent_name": agent.name,
                "user_email": user.email,
                "access_is_active": access.is_active,
                "expires_at": access.expires_at,
            },
            message=f"Access to '{agent.name}' {state} for {user.email}.",
        )


class UserAccessDiagnosticView(APIView):
    """
    GET /api/v1/users/<pk>/access-diagnostic/
    Full access picture for a user.
    Admin: only for their managed users.
    """
    permission_classes = [IsAuthenticated, IsAdminOrSuperAdmin]

    def get(self, request: Request, pk) -> Response:
        from django.utils import timezone
        from apps.agents.models import Agent, UserAgentAccess
        from apps.agents.group_models import AgentGroupMembership

        user = _get_user_or_404(pk)
        _check_admin_scope(request.user, user)

        now = timezone.now()

        all_agents = Agent.objects.all().order_by("name")

        direct_map = {
            a.agent_id: a
            for a in UserAgentAccess.objects.filter(user=user).select_related("agent")
        }

        group_map = {}
        memberships = (
            AgentGroupMembership.objects
            .filter(user=user)
            .select_related("group")
            .prefetch_related("group__agent_accesses__agent")
        )
        for membership in memberships:
            for ga in membership.group.agent_accesses.all():
                if ga.agent_id not in group_map:
                    group_map[ga.agent_id] = []
                group_map[ga.agent_id].append({
                    "group_id": str(membership.group.id),
                    "group_name": membership.group.name,
                    "group_is_active": membership.group.is_active,
                    "membership_is_active": membership.is_active,
                    "group_access_is_active": ga.is_active,
                })

        results = []
        for agent in all_agents:
            direct = direct_map.get(agent.id)
            groups = group_map.get(agent.id, [])

            has_access = False
            access_via = None
            block_reasons = []

            if direct:
                if not direct.is_active:
                    block_reasons.append("direct: access is revoked")
                elif direct.expires_at and direct.expires_at < now:
                    block_reasons.append(f"direct: expired at {direct.expires_at.strftime('%Y-%m-%d %H:%M UTC')}")
                elif not agent.is_active:
                    block_reasons.append("agent itself is inactive")
                else:
                    has_access = True
                    access_via = "direct"

            for g in groups:
                if not g["group_is_active"]:
                    block_reasons.append(f"group '{g['group_name']}': group is inactive")
                elif not g["membership_is_active"]:
                    block_reasons.append(f"group '{g['group_name']}': your membership is inactive")
                elif not g["group_access_is_active"]:
                    block_reasons.append(f"group '{g['group_name']}': agent removed from group")
                elif not agent.is_active:
                    block_reasons.append("agent itself is inactive")
                elif not has_access:
                    has_access = True
                    access_via = f"group: {g['group_name']}"

            results.append({
                "agent_id": str(agent.id),
                "agent_name": agent.name,
                "agent_is_active": agent.is_active,
                "has_access": has_access,
                "access_via": access_via,
                "direct_access": {
                    "exists": direct is not None,
                    "is_active": direct.is_active if direct else None,
                    "expires_at": direct.expires_at if direct else None,
                    "is_expired": (direct.expires_at < now) if (direct and direct.expires_at) else False,
                } if direct else None,
                "group_access": groups if groups else [],
                "block_reasons": block_reasons if not has_access else [],
            })

        return _success(
            data={
                "user": {
                    "id": str(user.id),
                    "email": user.email,
                    "is_active": user.is_active,
                    "is_locked": user.is_locked,
                    "managed_by": (
                        {"id": str(user.managed_by.id), "email": user.managed_by.email}
                        if user.managed_by else None
                    ),
                },
                "summary": {
                    "total_agents": len(results),
                    "accessible": sum(1 for r in results if r["has_access"]),
                    "blocked": sum(1 for r in results if not r["has_access"] and (r["direct_access"] or r["group_access"])),
                    "no_access_granted": sum(1 for r in results if not r["has_access"] and not r["direct_access"] and not r["group_access"]),
                },
                "agents": results,
            }
        )


# ── Role-based self-registration ──────────────────────────────────────────────

class AdminRegisterView(APIView):
    """
    POST /api/v1/auth/register/admin/

    Self-registration for admin accounts.
    Creates user (role=admin) + Organization with the Free plan in one transaction.
    Sends verification email.
    """
    permission_classes = [AllowAny]

    def post(self, request: Request) -> Response:
        serializer = AdminRegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user: CustomUser = serializer.save()
        # Admin accounts start as pending — superadmin must approve before login
        user.is_active = False
        user.approval_status = CustomUser.ApprovalStatus.PENDING
        user.save(update_fields=["is_active", "approval_status"])
        org = user.owned_organization
        return _success(
            data={
                "id": str(user.id),
                "email": user.email,
                "role": user.role,
                "approval_status": user.approval_status,
                "organization": {
                    "id": str(org.id),
                    "name": org.name,
                    "slug": org.slug,
                },
            },
            message="Registration submitted. Your account is under review and you will be notified by email once approved.",
            status_code=status.HTTP_201_CREATED,
        )


# ── Superadmin: admin registration approvals ──────────────────────────────────

class SuperadminPendingAdminsView(APIView):
    """GET /api/v1/superadmin/registrations/ — list all admin registrations grouped by status."""
    permission_classes = [IsSuperAdmin]

    def get(self, request: Request) -> Response:
        admins = CustomUser.objects.filter(role=CustomUser.Role.ADMIN).select_related(
            "profile"
        ).prefetch_related("managed_users").order_by("-date_joined")

        def _serialize(u):
            member_count = u.managed_users.filter(role=CustomUser.Role.USER).count()
            return {
                "id": str(u.id),
                "email": u.email,
                "approval_status": u.approval_status,
                "rejection_reason": u.rejection_reason,
                "date_joined": u.date_joined.isoformat(),
                "is_active": u.is_active,
                "first_name": getattr(getattr(u, "profile", None), "first_name", ""),
                "last_name": getattr(getattr(u, "profile", None), "last_name", ""),
                "member_count": member_count,
            }

        pending  = [_serialize(u) for u in admins if u.approval_status == CustomUser.ApprovalStatus.PENDING]
        approved = [_serialize(u) for u in admins if u.approval_status == CustomUser.ApprovalStatus.APPROVED]
        rejected = [_serialize(u) for u in admins if u.approval_status == CustomUser.ApprovalStatus.REJECTED]

        return _success(data={
            "pending": pending,
            "approved": approved,
            "rejected": rejected,
            "counts": {"pending": len(pending), "approved": len(approved), "rejected": len(rejected)},
        })


class SuperadminApproveAdminView(APIView):
    """POST /api/v1/superadmin/registrations/{id}/decide/ — approve or reject an admin."""
    permission_classes = [IsSuperAdmin]

    def post(self, request: Request, admin_id: str) -> Response:
        try:
            admin = CustomUser.objects.get(id=admin_id, role=CustomUser.Role.ADMIN)
        except CustomUser.DoesNotExist:
            return Response({"success": False, "error": {"message": "Admin not found."}}, status=404)

        action = request.data.get("action")  # "approve" or "reject"
        reason = request.data.get("reason", "").strip()

        if action == "approve":
            admin.is_active = True
            admin.approval_status = CustomUser.ApprovalStatus.APPROVED
            admin.rejection_reason = ""
            admin.save(update_fields=["is_active", "approval_status", "rejection_reason"])
            try:
                _send_html_email(
                    subject="Your admin account has been approved",
                    template="emails/approve_admin.html",
                    context={
                        "admin_email": admin.email,
                        "login_url": f"{_frontend_url()}/login",
                    },
                    recipient=admin.email,
                )
            except Exception:
                pass
            return _success(message=f"Admin {admin.email} approved.")

        elif action == "reject":
            admin.is_active = False
            admin.approval_status = CustomUser.ApprovalStatus.REJECTED
            admin.rejection_reason = reason
            admin.save(update_fields=["is_active", "approval_status", "rejection_reason"])
            try:
                _send_html_email(
                    subject="Your admin registration was not approved",
                    template="emails/reject_admin.html",
                    context={
                        "admin_email": admin.email,
                        "reason": reason,
                    },
                    recipient=admin.email,
                )
            except Exception:
                pass
            return _success(message=f"Admin {admin.email} rejected.")

        return Response({"success": False, "error": {"message": "action must be 'approve' or 'reject'."}}, status=400)


# ── Admin: invited users list ─────────────────────────────────────────────────

class AdminInviteListView(APIView):
    """GET /api/v1/admin/members/ — all users invited by this admin with signup status."""
    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        if not (request.user.is_admin or request.user.is_superadmin):
            raise PermissionDenied()

        invites = InviteToken.objects.filter(
            invited_by=request.user
        ).order_by("-created_at")

        result = []
        for inv in invites:
            try:
                user = CustomUser.objects.get(email=inv.email)
                signup_status = "accepted"
                user_id = str(user.id)
                date_joined = user.date_joined.isoformat()
            except CustomUser.DoesNotExist:
                signup_status = "pending"
                user_id = None
                date_joined = None

            result.append({
                "invite_id": str(inv.id),
                "email": inv.email,
                "invited_role": inv.invited_role,
                "signup_status": signup_status,
                "user_id": user_id,
                "date_joined": date_joined,
                "invited_at": inv.created_at.isoformat(),
                "expires_at": inv.expires_at.isoformat(),
                "is_expired": inv.is_expired,
                "token": str(inv.token),
            })

        active_count = sum(1 for r in result if r["signup_status"] == "accepted")
        pending_count = sum(1 for r in result if r["signup_status"] == "pending")

        return _success(data={
            "members": result,
            "counts": {"total": len(result), "accepted": active_count, "pending": pending_count},
        })


class AdminResendInviteView(APIView):
    """POST /api/v1/admin/members/{invite_id}/resend/ — resend invite email."""
    permission_classes = [IsAuthenticated]

    def post(self, request: Request, invite_id: str) -> Response:
        if not (request.user.is_admin or request.user.is_superadmin):
            raise PermissionDenied()

        try:
            invite = InviteToken.objects.get(id=invite_id, invited_by=request.user)
        except InviteToken.DoesNotExist:
            return Response({"success": False, "error": {"message": "Invite not found."}}, status=404)

        if invite.is_used:
            return Response({"success": False, "error": {"message": "This invite has already been used."}}, status=400)

        # Extend expiry by 7 days and resend
        from django.utils import timezone as tz
        invite.expires_at = tz.now() + tz.timedelta(days=7)
        invite.save(update_fields=["expires_at"])

        invite_url = f"{_frontend_url()}/invite?token={invite.token}"
        app_name = getattr(settings, "APP_NAME", "Life Science AI")
        org_name = getattr(getattr(invite.invited_by, "owned_organization", None), "name", None) or app_name
        try:
            _send_html_email(
                subject=f"{org_name} has invited you to {app_name}",
                template="emails/invite_link.html",
                context={
                    "email": invite.email,
                    "invited_by": invite.invited_by.email,
                    "org_name": org_name,
                    "invite_url": invite_url,
                    "expires_hours": 168,
                },
                recipient=invite.email,
            )
        except Exception:
            pass

        return _success(message=f"Invite resent to {invite.email}.")
