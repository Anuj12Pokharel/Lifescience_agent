from django.urls import path

from apps.accounts.views import (
    AdminInviteListView,
    AdminRegisterView,
    AdminResendInviteView,
    ChangePasswordView,
    CompleteInviteView,
    ForgotPasswordView,
    LoginView,
    LogoutView,
    ResendOTPView,
    ResendVerificationView,
    ResetPasswordView,
    SuperadminApproveAdminView,
    SuperadminPendingAdminsView,
    TokenRefreshCookieView,
    ValidateInviteTokenView,
    VerifyEmailView,
    VerifyOTPView,
)

app_name = "accounts"

urlpatterns = [
    # ── Registration ──────────────────────────────────────────────────────────
    path("register/admin/", AdminRegisterView.as_view(), name="register-admin"),

    # ── Superadmin: admin approval ────────────────────────────────────────────
    path("superadmin/registrations/", SuperadminPendingAdminsView.as_view(), name="superadmin-registrations"),
    path("superadmin/registrations/<uuid:admin_id>/decide/", SuperadminApproveAdminView.as_view(), name="superadmin-decide"),

    # ── Admin: members / invite management ────────────────────────────────────
    path("admin/members/", AdminInviteListView.as_view(), name="admin-members"),
    path("admin/members/<uuid:invite_id>/resend/", AdminResendInviteView.as_view(), name="admin-resend-invite"),

    # ── Invite-link flow ──────────────────────────────────────────────────────
    path("invite/validate/", ValidateInviteTokenView.as_view(), name="invite-validate"),
    path("invite/complete/", CompleteInviteView.as_view(), name="invite-complete"),

    # ── OTP verification (kept for backward compat) ───────────────────────────
    path("verify-otp/", VerifyOTPView.as_view(), name="verify-otp"),
    path("resend-otp/", ResendOTPView.as_view(), name="resend-otp"),

    # ── Email verification ────────────────────────────────────────────────────
    path("verify-email/", VerifyEmailView.as_view(), name="verify-email"),
    path("resend-verification/", ResendVerificationView.as_view(), name="resend-verification"),

    # ── Session ───────────────────────────────────────────────────────────────
    path("login/", LoginView.as_view(), name="login"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("token/refresh/", TokenRefreshCookieView.as_view(), name="token-refresh"),

    # ── Password management ───────────────────────────────────────────────────
    path("forgot-password/", ForgotPasswordView.as_view(), name="forgot-password"),
    path("reset-password/", ResetPasswordView.as_view(), name="reset-password"),
    path("change-password/", ChangePasswordView.as_view(), name="change-password"),
]
