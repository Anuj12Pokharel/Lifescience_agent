from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response


class StandardResultsSetPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100
    page_query_param = "page"

    def get_paginated_response(self, data):
        return Response(
            {
                "success": True,
                "pagination": {
                    "count": self.page.paginator.count,
                    "total_pages": self.page.paginator.num_pages,
                    "current_page": self.page.number,
                    "page_size": self.get_page_size(self.request),
                    "next": self.get_next_link(),
                    "previous": self.get_previous_link(),
                },
                "results": data,
            }
        )

    def get_paginated_response_schema(self, schema):
        return {
            "type": "object",
            "required": ["success", "pagination", "results"],
            "properties": {
                "success": {"type": "boolean", "example": True},
                "pagination": {
                    "type": "object",
                    "properties": {
                        "count": {"type": "integer", "example": 123},
                        "total_pages": {"type": "integer", "example": 7},
                        "current_page": {"type": "integer", "example": 1},
                        "page_size": {"type": "integer", "example": 20},
                        "next": {
                            "type": "string",
                            "nullable": True,
                            "format": "uri",
                            "example": "http://api.example.com/items/?page=2",
                        },
                        "previous": {
                            "type": "string",
                            "nullable": True,
                            "format": "uri",
                            "example": None,
                        },
                    },
                },
                "results": schema,
            },
        }


class LargeResultsSetPagination(StandardResultsSetPagination):
    """For endpoints that justify bigger default pages (e.g. export-style lists)."""
    page_size = 50
    max_page_size = 500


class SmallResultsSetPagination(StandardResultsSetPagination):
    """For endpoints with heavier payloads where smaller pages are preferable."""
    page_size = 10
    max_page_size = 50
