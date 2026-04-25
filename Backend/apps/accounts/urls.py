from django.urls import path

from apps.accounts.views import (
    AdminRegisterView,
    ChangePasswordView,
    ForgotPasswordView,
    LoginView,
    LogoutView,
    RegisterView,
    ResendVerificationView,
    ResetPasswordView,
    TokenRefreshCookieView,
    VerifyEmailView,
)

app_name = "accounts"

urlpatterns = [
    # ── Registration & email verification ────────────────────────────────────
    path("register/", RegisterView.as_view(), name="register"),
    path("register/admin/", AdminRegisterView.as_view(), name="register-admin"),
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
