from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('organizations', '0005_agentsession'),
    ]

    operations = [
        migrations.AddField(
            model_name='agentsession',
            name='user_name',
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name='agentsession',
            name='user_email',
            field=models.EmailField(blank=True),
        ),
        migrations.AddField(
            model_name='agentsession',
            name='gemini_api_key',
            field=models.CharField(blank=True, max_length=500),
        ),
        migrations.AddField(
            model_name='agentsession',
            name='expires_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
