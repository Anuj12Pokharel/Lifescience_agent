from django.db import migrations


def create_initial_company_data(apps, schema_editor):
    """
    Create initial company data with the provided structure.
    """
    Company = apps.get_model('company', 'Company')
    Event = apps.get_model('company', 'Event')
    
    # Create company with the provided data
    company_data = {
        'name': 'Life Science AI',
        'location': 'Level 1, 9 The Esplanade, Perth WA 6000, Australia',
        'website': 'lifescienceai.com.au',
        'email': 'connect@lifescienceai.com.au',
        'timezone': 'Perth, Australia (AWST, UTC+8)',
        'mission': 'Empower professionals and organisations with practical AI tools...',
        'pillars': [
            "Data with Integrity — transparency and ethical governance",
            "Minds with Curiosity — nurturing learning, creativity, and critical thinking",
            "Wellbeing with Compassion — designing AI to uplift health and happiness"
        ],
        'services': [
            "AI Education & Capability Building — CPD-accredited training, workshops",
            "AI Strategy & Implementation — practical AI strategies aligned with goals",
            "Data-Driven Health & Wellbeing Solutions — population health tools",
            "Innovation Partnerships — collaborations with universities and startups",
            "Data & Analytics — reliable data infrastructure, advanced analytics",
            "Healthcare AI Solutions — medical imaging, predictive analytics",
            "Automation & Workflow Optimisation — AI-driven automation"
        ],
        'who_we_serve': [
            "Healthcare providers, hospitals, clinics",
            "Government health departments",
            "Life science and biotech firms",
            "Universities and research organisations",
            "Corporate organisations focused on workforce wellbeing",
            "Private enterprises"
        ],
        'process': [
            "Step 1 — Initial Conversation: Explore goals and challenges",
            "Step 2 — Implementation: Safe integration of AI tools",
            "Step 3 — Continued Training & Support: Six months of guidance",
            "Step 4 — Ongoing Support: Monthly check-ins and performance reviews"
        ],
        'system_prompt': 'You are AVA — the AI Reception & Inquiry Assistant for Life Science AI...',
        'managed_by': None  # Only superadmins can edit initially
    }
    
    company = Company.objects.create(**company_data)
    
    # Create the sample event
    event_data = {
        'title': 'AI Workshop: How to Grow Your Business With Digital Marketing Tools',
        'description': 'Featuring AVA AI Agent demonstrations — website creation, social media automation, avatar bot creation',
        'date': '2026-02-06',
        'time': '13:30:00',
        'timezone': 'Perth (AWST)',
        'format': 'Interactive workshop',
        'is_active': True,
        'managed_by': None  # Only superadmins can edit initially
    }
    
    Event.objects.create(**event_data)


def reverse_initial_company_data(apps, schema_editor):
    """
    Reverse the initial company data creation.
    """
    Company = apps.get_model('company', 'Company')
    Event = apps.get_model('company', 'Event')
    
    # Delete all company and event data
    Company.objects.all().delete()
    Event.objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ('company', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(
            create_initial_company_data,
            reverse_initial_company_data,
        ),
    ]
