from django.db import migrations, models
import django.db.models.deletion
import uuid
from django.conf import settings

class Migration(migrations.Migration):

    dependencies = [
        ('integrations', '0005_add_jira_project_scope'),
        ('organizations', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='GmailCredential',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('gmail_email', models.EmailField(help_text='The Gmail address that was connected (for display only).', max_length=254)),
                ('access_token', models.TextField(blank=True)),
                ('refresh_token', models.TextField(blank=True)),
                ('token_expiry', models.DateTimeField(blank=True, null=True)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('connected_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='connected_gmail', to=settings.AUTH_USER_MODEL)),
                ('org', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='gmail_credential', to='organizations.organization')),
            ],
            options={
                'verbose_name': 'Gmail Credential',
                'verbose_name_plural': 'Gmail Credentials',
                'db_table': 'integrations_gmail_credential',
            },
        ),
    ]
