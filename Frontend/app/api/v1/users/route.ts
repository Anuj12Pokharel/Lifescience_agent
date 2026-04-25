import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const page_size = parseInt(searchParams.get('page_size') || '10');
  const search = searchParams.get('search') || '';
  const role = searchParams.get('role') || '';
  const is_active = searchParams.get('is_active') || '';
  
  // Mock response following the API specification format
  const mockUsers = [
    {
      id: "bd2ea323-7676-4d01-abac-61724d7e415b",
      email: "pratyushlamichhane2062@gmail.com",
      role: "user",
      managed_by: {
        id: "47ffe6bd-e808-447e-b53f-d89ac5776c35",
        email: "salongautam4@gmail.com"
      },
      is_verified: true,
      is_active: true,
      is_locked: false,
      failed_login_attempts: 0,
      last_login_ip: "172.21.0.1",
      last_login: null,
      date_joined: "2026-03-31T17:21:37.300728Z"
    },
    {
      id: "user-2",
      email: "testuser1@example.com",
      role: "user",
      managed_by: {
        id: "47ffe6bd-e808-447e-b53f-d89ac5776c35",
        email: "salongautam4@gmail.com"
      },
      is_verified: true,
      is_active: true,
      is_locked: false,
      failed_login_attempts: 0,
      last_login_ip: "172.21.0.1",
      last_login: "2026-03-30T10:15:00Z",
      date_joined: "2026-03-25T14:30:00Z"
    },
    {
      id: "user-3",
      email: "testuser2@example.com",
      role: "user",
      managed_by: {
        id: "47ffe6bd-e808-447e-b53f-d89ac5776c35",
        email: "salongautam4@gmail.com"
      },
      is_verified: true,
      is_active: true,
      is_locked: false,
      failed_login_attempts: 0,
      last_login_ip: "172.21.0.1",
      last_login: "2026-03-29T16:45:00Z",
      date_joined: "2026-03-20T09:20:00Z"
    },
    {
      id: "user-4",
      email: "inactive@example.com",
      role: "user",
      managed_by: {
        id: "47ffe6bd-e808-447e-b53f-d89ac5776c35",
        email: "salongautam4@gmail.com"
      },
      is_verified: false,
      is_active: false,
      is_locked: false,
      failed_login_attempts: 3,
      last_login_ip: null,
      last_login: null,
      date_joined: "2026-03-15T11:10:00Z"
    }
  ];

  // Apply filters
  let filteredUsers = mockUsers;
  
  if (search) {
    filteredUsers = filteredUsers.filter(user => 
      user.email.toLowerCase().includes(search.toLowerCase())
    );
  }
  
  if (role) {
    filteredUsers = filteredUsers.filter(user => user.role === role);
  }
  
  if (is_active) {
    const activeFilter = is_active === 'true';
    filteredUsers = filteredUsers.filter(user => user.is_active === activeFilter);
  }

  // Simulate pagination
  const total = filteredUsers.length;
  const start = (page - 1) * page_size;
  const end = start + page_size;
  const results = filteredUsers.slice(start, end);

  return NextResponse.json({
    success: true,
    count: total,
    next: end < total ? `http://localhost:3000/api/v1/users/?page=${page + 1}&page_size=${page_size}` : null,
    previous: page > 1 ? `http://localhost:3000/api/v1/users/?page=${page - 1}&page_size=${page_size}` : null,
    results
  });
}
