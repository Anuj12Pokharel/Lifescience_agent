from rest_framework import status
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema

from apps.accounts.permissions import IsSuperAdmin
from apps.company.models import Company, Event
from apps.company.permissions import CanEditCompanyOrEvent, IsAdminOrSuperAdminOrReadOnly
from apps.company.serializers import CompanySerializer, EventSerializer


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_company_or_404(pk):
    try:
        return Company.objects.get(pk=pk)
    except Company.DoesNotExist:
        raise NotFound("Company not found.")


def _get_event_or_404(event_id):
    try:
        return Event.objects.get(id=event_id)
    except Event.DoesNotExist:
        raise NotFound("Event not found.")


# ── Company views ─────────────────────────────────────────────────────────────

class CompanyListCreateView(APIView):
    """
    GET  /api/v1/company/         — list all companies (any authenticated user)
    POST /api/v1/company/         — create a company (superadmin only)
    """

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAuthenticated(), IsSuperAdmin()]
        return [IsAuthenticated()]

    @extend_schema(
        tags=["Company"],
        summary="List all companies",
        responses={200: CompanySerializer(many=True)},
    )
    def get(self, request: Request) -> Response:
        companies = Company.objects.all().order_by('-created_at')
        serializer = CompanySerializer(companies, many=True, context={'request': request})
        return Response({"success": True, "data": serializer.data})

    @extend_schema(
        tags=["Company"],
        summary="Create a company (superadmin only)",
        request=CompanySerializer,
        responses={
            201: CompanySerializer,
            403: OpenApiResponse(description="Superadmin only"),
            422: OpenApiResponse(description="Validation error"),
        },
    )
    def post(self, request: Request) -> Response:
        serializer = CompanySerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        company = serializer.save()
        return Response(
            {"success": True, "message": "Company created successfully.", "data": serializer.data},
            status=status.HTTP_201_CREATED,
        )


class CompanyDetailView(APIView):
    """
    GET    /api/v1/company/<pk>/  — retrieve a company (any authenticated user)
    PUT    /api/v1/company/<pk>/  — update a company (superadmin or assigned admin)
    DELETE /api/v1/company/<pk>/  — delete a company (superadmin only)
    """

    def get_permissions(self):
        if self.request.method == 'DELETE':
            return [IsAuthenticated(), IsSuperAdmin()]
        return [IsAuthenticated()]

    @extend_schema(
        tags=["Company"],
        summary="Retrieve company detail",
        responses={200: CompanySerializer},
    )
    def get(self, request: Request, pk) -> Response:
        company = _get_company_or_404(pk)
        serializer = CompanySerializer(company, context={'request': request})
        return Response({"success": True, "data": serializer.data})

    @extend_schema(
        tags=["Company"],
        summary="Update company (superadmin or assigned admin)",
        request=CompanySerializer,
        responses={
            200: CompanySerializer,
            403: OpenApiResponse(description="Not permitted"),
        },
    )
    def put(self, request: Request, pk) -> Response:
        company = _get_company_or_404(pk)
        if not company.can_be_edited_by(request.user):
            raise PermissionDenied("You do not have permission to edit this company.")

        serializer = CompanySerializer(company, data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"success": True, "message": "Company updated.", "data": serializer.data})

    @extend_schema(
        tags=["Company"],
        summary="Delete company (superadmin only)",
        responses={204: OpenApiResponse(description="Deleted")},
    )
    def delete(self, request: Request, pk) -> Response:
        company = _get_company_or_404(pk)
        company.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class CompanyAssignAdminView(APIView):
    """
    POST /api/v1/company/<pk>/assign-admin/
    Superadmin assigns (or clears) the admin who manages this company.
    Body: { "managed_by": "<admin-uuid>" }  or  { "managed_by": null }
    """
    permission_classes = [IsAuthenticated, IsSuperAdmin]

    @extend_schema(
        tags=["Company"],
        summary="Assign admin to company (superadmin only)",
        request=CompanySerializer,
        responses={200: CompanySerializer},
    )
    def post(self, request: Request, pk) -> Response:
        company = _get_company_or_404(pk)
        managed_by_id = request.data.get('managed_by', '__unset__')

        if managed_by_id == '__unset__':
            raise PermissionDenied("Provide 'managed_by' (admin UUID or null).")

        # Reuse serializer validation for managed_by field
        serializer = CompanySerializer(
            company,
            data={'managed_by': managed_by_id},
            partial=True,
            context={'request': request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response({
            "success": True,
            "message": (
                f"Company '{company.name}' is now managed by "
                f"{company.managed_by.email}." if company.managed_by
                else f"Company '{company.name}' has no assigned admin (superadmin only)."
            ),
            "data": CompanySerializer(company, context={'request': request}).data,
        })


# ── Event views ───────────────────────────────────────────────────────────────

class EventListView(APIView):
    """
    GET  /api/v1/company/events/  — list all events (any authenticated user)
    POST /api/v1/company/events/  — create event (admin or superadmin)
    """
    permission_classes = [IsAdminOrSuperAdminOrReadOnly]

    @extend_schema(
        tags=["Company — Events"],
        summary="List all events",
        responses={200: EventSerializer(many=True)},
    )
    def get(self, request: Request) -> Response:
        events = Event.objects.all()
        serializer = EventSerializer(events, many=True, context={'request': request})
        return Response({"success": True, "data": serializer.data})

    @extend_schema(
        tags=["Company — Events"],
        summary="Create event (admin or superadmin)",
        request=EventSerializer,
        responses={201: EventSerializer, 422: OpenApiResponse(description="Validation error")},
    )
    def post(self, request: Request) -> Response:
        data = request.data.copy()
        # Admins are automatically the manager of events they create
        if request.user.is_admin:
            data['managed_by'] = str(request.user.id)

        serializer = EventSerializer(data=data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(
            {"success": True, "message": "Event created.", "data": serializer.data},
            status=status.HTTP_201_CREATED,
        )


class EventDetailView(APIView):
    """
    GET    /api/v1/company/events/<id>/  — retrieve (any authenticated user)
    PUT    /api/v1/company/events/<id>/  — update (superadmin or assigned admin)
    DELETE /api/v1/company/events/<id>/  — delete (superadmin or assigned admin)
    """
    permission_classes = [IsAdminOrSuperAdminOrReadOnly]

    @extend_schema(tags=["Company — Events"], summary="Retrieve event")
    def get(self, request: Request, event_id) -> Response:
        event = _get_event_or_404(event_id)
        return Response({"success": True, "data": EventSerializer(event, context={'request': request}).data})

    @extend_schema(
        tags=["Company — Events"],
        summary="Update event (superadmin or assigned admin)",
        request=EventSerializer,
        responses={200: EventSerializer},
    )
    def put(self, request: Request, event_id) -> Response:
        event = _get_event_or_404(event_id)
        if not event.can_be_edited_by(request.user):
            raise PermissionDenied("You do not have permission to edit this event.")

        data = request.data.copy()
        if request.user.is_admin:
            data['managed_by'] = str(request.user.id)

        serializer = EventSerializer(event, data=data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"success": True, "message": "Event updated.", "data": serializer.data})

    @extend_schema(tags=["Company — Events"], summary="Delete event (superadmin or assigned admin)")
    def delete(self, request: Request, event_id) -> Response:
        event = _get_event_or_404(event_id)
        if not event.can_be_edited_by(request.user):
            raise PermissionDenied("You do not have permission to delete this event.")
        event.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class EventToggleView(APIView):
    """
    POST /api/v1/company/events/<id>/toggle/
    Flip is_active. Superadmin or assigned admin only.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Company — Events"],
        summary="Toggle event active status",
        request=None,
        responses={200: EventSerializer},
    )
    def post(self, request: Request, event_id) -> Response:
        event = _get_event_or_404(event_id)
        if not event.can_be_edited_by(request.user):
            raise PermissionDenied("You do not have permission to modify this event.")
        event.is_active = not event.is_active
        event.save(update_fields=['is_active'])
        return Response({"success": True, "data": EventSerializer(event, context={'request': request}).data})
