from django.urls import path

from apps.accounts.views import (
    AdminRegisterView,
    ChangePasswordView,
    CompleteInviteView,
    ForgotPasswordView,
    LoginView,
    LogoutView,
    ResendOTPView,
    ResendVerificationView,
    ResetPasswordView,
    TokenRefreshCookieView,
    ValidateInviteTokenView,
    VerifyEmailView,
    VerifyOTPView,
)

app_name = "accounts"

urlpatterns = [
    # ── Registration (admin self-registration only; users come via invite) ────
    path("register/admin/", AdminRegisterView.as_view(), name="register-admin"),

    # ── Invite-link flow ──────────────────────────────────────────────────────
    path("invite/validate/", ValidateInviteTokenView.as_view(), name="invite-validate"),
    path("invite/complete/", CompleteInviteView.as_view(), name="invite-complete"),

    # ── OTP verification ──────────────────────────────────────────────────────
    path("verify-otp/", VerifyOTPView.as_view(), name="verify-otp"),
    path("resend-otp/", ResendOTPView.as_view(), name="resend-otp"),

    # ── Legacy email verification (kept for admin self-registration flow) ─────
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
