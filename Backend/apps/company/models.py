import uuid
from django.db import models
from django.contrib.postgres.fields import ArrayField
from django.utils import timezone


class Company(models.Model):
    """
    Company information model that can be edited by superadmins and associated admins.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Basic company info
    name = models.CharField(max_length=200, default="Life Science AI")
    location = models.TextField(default="Level 1, 9 The Esplanade, Perth WA 6000, Australia")
    website = models.URLField(default="lifescienceai.com.au")
    email = models.EmailField(default="connect@lifescienceai.com.au")
    timezone = models.CharField(max_length=100, default="Perth, Australia (AWST, UTC+8)")
    
    # Company details
    mission = models.TextField(
        default="Empower professionals and organisations with practical AI tools...",
        blank=True
    )
    
    # JSON fields for structured data
    pillars = models.JSONField(
        default=list,
        blank=True,
        help_text="List of company pillars"
    )
    
    services = models.JSONField(
        default=list,
        blank=True,
        help_text="List of services offered"
    )
    
    who_we_serve = models.JSONField(
        default=list,
        blank=True,
        help_text="List of target audiences"
    )
    
    process = models.JSONField(
        default=list,
        blank=True,
        help_text="Company process steps"
    )
    
    # System fields
    system_prompt = models.TextField(
        default="You are AVA — the AI Reception & Inquiry Assistant for Life Science AI...",
        blank=True,
        help_text="System prompt for AI assistant"
    )
    
    # Admin association - which admin can manage this company info
    # Null means only superadmins can edit
    managed_by = models.ForeignKey(
        'accounts.CustomUser',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="managed_companies",
        limit_choices_to={'role': 'admin'},
        help_text="Admin who can manage this company info. Null = superadmin only"
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "company_company"
        verbose_name = "Company"
        verbose_name_plural = "Companies"
        ordering = ["-created_at"]

    def __str__(self):
        return self.name

    def can_be_edited_by(self, user):
        """
        Check if a user can edit this company information.
        - Superadmins can always edit
        - Admins can edit only if they are associated (managed_by)
        """
        if user.is_superadmin:
            return True
        if user.is_admin and self.managed_by_id == user.id:
            return True
        return False


class Event(models.Model):
    """
    Upcoming events model that can be managed by superadmins and associated admins.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    date = models.DateField()
    time = models.TimeField()
    timezone = models.CharField(max_length=100, default="Perth (AWST)")
    format = models.CharField(max_length=100, default="Interactive workshop")
    
    # Event status
    is_active = models.BooleanField(default=True)
    
    # Admin association - which admin can manage this event
    # Null means only superadmins can edit
    managed_by = models.ForeignKey(
        'accounts.CustomUser',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="managed_events",
        limit_choices_to={'role': 'admin'},
        help_text="Admin who can manage this event. Null = superadmin only"
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "company_event"
        verbose_name = "Event"
        verbose_name_plural = "Events"
        ordering = ["date", "time"]

    def __str__(self):
        return f"{self.title} - {self.date}"

    def can_be_edited_by(self, user):
        """
        Check if a user can edit this event.
        - Superadmins can always edit
        - Admins can edit only if they are associated (managed_by)
        """
        if user.is_superadmin:
            return True
        if user.is_admin and self.managed_by_id == user.id:
            return True
        return False
