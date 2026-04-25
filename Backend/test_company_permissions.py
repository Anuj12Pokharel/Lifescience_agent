#!/usr/bin/env python
"""
Test script to demonstrate company and events API permissions.
This script shows how the role-based permissions work:

1. Superadmin can edit company info and events (regardless of managed_by)
2. Admin can only edit company info and events if they are associated (managed_by)
3. Regular users can only read company info and events
"""

import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from apps.accounts.models import CustomUser
from apps.company.models import Company, Event


def create_test_users():
    """Create test users with different roles."""
    print("Creating test users...")
    
    # Create superadmin
    superadmin, created = CustomUser.objects.get_or_create(
        email='superadmin@test.com',
        defaults={
            'role': CustomUser.Role.SUPERADMIN,
            'is_staff': True,
            'is_superuser': True,
            'is_verified': True,
        }
    )
    if created:
        superadmin.set_password('testpass123')
        superadmin.save()
        print(f"✓ Created superadmin: {superadmin.email}")
    else:
        print(f"✓ Superadmin already exists: {superadmin.email}")
    
    # Create admin
    admin, created = CustomUser.objects.get_or_create(
        email='admin@test.com',
        defaults={
            'role': CustomUser.Role.ADMIN,
            'is_staff': True,
            'is_verified': True,
        }
    )
    if created:
        admin.set_password('testpass123')
        admin.save()
        print(f"✓ Created admin: {admin.email}")
    else:
        print(f"✓ Admin already exists: {admin.email}")
    
    # Create regular user
    user, created = CustomUser.objects.get_or_create(
        email='user@test.com',
        defaults={
            'role': CustomUser.Role.USER,
            'is_verified': True,
        }
    )
    if created:
        user.set_password('testpass123')
        user.save()
        print(f"✓ Created user: {user.email}")
    else:
        print(f"✓ User already exists: {user.email}")
    
    return superadmin, admin, user


def test_permissions():
    """Test permission scenarios."""
    superadmin, admin, user = create_test_users()
    
    # Get company and events
    company = Company.objects.first()
    events = Event.objects.all()
    
    print(f"\n{'='*60}")
    print("PERMISSION TESTING")
    print(f"{'='*60}")
    
    # Test company permissions
    print(f"\n📋 COMPANY: {company.name}")
    print(f"   Currently managed by: {company.managed_by or 'Superadmin only'}")
    
    print(f"\n   🧪 Superadmin can edit: {company.can_be_edited_by(superadmin)}")
    print(f"   🧪 Admin can edit: {company.can_be_edited_by(admin)}")
    print(f"   🧪 User can edit: {company.can_be_edited_by(user)}")
    
    # Associate admin with company
    company.managed_by = admin
    company.save()
    print(f"\n   🔗 Admin associated with company")
    print(f"   🧪 Admin can edit now: {company.can_be_edited_by(admin)}")
    
    # Test event permissions
    for event in events:
        print(f"\n📅 EVENT: {event.title}")
        print(f"   Currently managed by: {event.managed_by or 'Superadmin only'}")
        
        print(f"   🧪 Superadmin can edit: {event.can_be_edited_by(superadmin)}")
        print(f"   🧪 Admin can edit: {event.can_be_edited_by(admin)}")
        print(f"   🧪 User can edit: {event.can_be_edited_by(user)}")
        
        # Associate admin with event
        event.managed_by = admin
        event.save()
        print(f"   🔗 Admin associated with event")
        print(f"   🧪 Admin can edit now: {event.can_be_edited_by(admin)}")
    
    print(f"\n{'='*60}")
    print("API ENDPOINTS")
    print(f"{'='*60}")
    
    print("\n📋 Company API:")
    print("   GET    /api/v1/company/           - Any authenticated user")
    print("   PUT    /api/v1/company/           - Superadmin OR associated admin")
    
    print("\n📅 Events API:")
    print("   GET    /api/v1/company/events/    - Any authenticated user")
    print("   POST   /api/v1/company/events/    - Superadmin OR admin")
    print("   GET    /api/v1/company/events/<id>/ - Any authenticated user")
    print("   PUT    /api/v1/company/events/<id>/ - Superadmin OR associated admin")
    print("   DELETE /api/v1/company/events/<id>/ - Superadmin OR associated admin")
    print("   POST   /api/v1/company/events/<id>/toggle/ - Superadmin OR associated admin")
    
    print(f"\n{'='*60}")
    print("USAGE EXAMPLES")
    print(f"{'='*60}")
    
    print("\n🔐 Authentication required for all endpoints")
    print("📝 Use JWT tokens (login via /api/v1/auth/login/)")
    
    print("\n📋 To associate an admin with company/events:")
    print("   1. Superadmin updates company/event with managed_by=admin_id")
    print("   2. Admin can then edit that specific company/event")
    print("   3. Admin cannot edit company/events managed by other admins")
    
    print("\n🎯 Key Rules:")
    print("   ✓ Superadmins can edit everything")
    print("   ✓ Admins can only edit what they manage")
    print("   ✓ Regular users can only read")
    print("   ✓ managed_by field controls admin access")


if __name__ == '__main__':
    test_permissions()
