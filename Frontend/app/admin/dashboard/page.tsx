'use client';

import Link from 'next/link';
import DashboardLayout from '@/components/dashboard-layout';
import { Users, Bot, Shield, Activity, UsersRound, ArrowRight, Building, Calendar, UserPlus } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useAuth } from '@/lib/auth-context';
import { useQuery } from '@tanstack/react-query';
import { organizationsApi, membersApi } from '@/lib/api-client';

export default function AdminDashboardPage() {
  const { user } = useAuth();

  const { data: stats } = useQuery({
    queryKey: ['org', 'stats'],
    queryFn: organizationsApi.getMyOrgStats,
  });

  const { data: membersData } = useQuery({
    queryKey: ['admin-members'],
    queryFn: membersApi.list,
  });

  const metricCards = [
    { label: 'Members',           value: stats?.member_count,           icon: Users,     color: 'text-cyan-400',   bg: 'bg-cyan-500/20',   href: '/admin/users'        },
    { label: 'Pending Invites',   value: membersData?.counts?.pending,  icon: UserPlus,  color: 'text-violet-400', bg: 'bg-violet-500/20', href: '/admin/users'        },
    { label: 'Subscribed Agents', value: stats?.subscribed_agent_count, icon: Bot,       color: 'text-blue-400',   bg: 'bg-blue-500/20',   href: '/admin/organization' },
    { label: 'Groups',            value: stats?.group_count,            icon: UsersRound,color: 'text-purple-400', bg: 'bg-purple-500/20', href: '/admin/groups'       },
  ];

  return (
    <DashboardLayout requireAdmin>
      <div className="flex flex-col gap-8 max-w-6xl mx-auto">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-white mb-3">Admin Overview</h1>
          <p className="text-lg text-slate-400 max-w-3xl leading-relaxed">
            Welcome back, <span className="text-cyan-400 font-semibold">{user?.email}</span>. Here is the current platform status at a glance.
          </p>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {metricCards.map(({ label, value, icon: Icon, color, bg, href }) => {
            const cardContent = (
              <Card className={`bg-slate-900/60 backdrop-blur-sm border border-slate-700/50 transition-all duration-300 hover:-translate-y-1 hover:bg-slate-800/60 ${href ? 'cursor-pointer hover:shadow-xl hover:shadow-cyan-500/20' : ''}`}>
                <CardHeader className="flex flex-row items-center justify-between pb-3 space-y-0 relative">
                  <div className={`p-3 rounded-xl ${bg} backdrop-blur-md border border-white/10 cursor-pointer group`}>
                    <Icon className={`h-6 w-6 ${color} drop-shadow-sm transition-transform duration-200 group-hover:scale-110`} />
                  </div>
                  {href && <ArrowRight className="h-4 w-4 text-slate-400 opacity-100 transition-opacity absolute right-6 top-6" />}
                </CardHeader>
                <CardContent className="pt-0">
                  <div className={`text-4xl font-black tracking-tight ${color} drop-shadow-sm mb-2`}>
                    {value === undefined ? <span className="opacity-30">—</span> : value}
                  </div>
                  <p className="text-sm font-semibold text-slate-300">{label}</p>
                </CardContent>
              </Card>
            );

            return href ? (
              <Link key={label} href={href} className="group block focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background rounded-xl">
                {cardContent}
              </Link>
            ) : (
              <div key={label}>{cardContent}</div>
            );
          })}
        </div>

        {/* Quick Links / Modules section */}
        <div className="mt-8">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-3 text-white">
            <div className="p-2 rounded-lg bg-amber-500/20 border border-amber-500/30 cursor-pointer">
              <Shield className="h-6 w-6 text-amber-400 transition-transform duration-200 hover:scale-110" />
            </div>
            Administrative Modules
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             {[
               { title: 'Members', desc: 'View accounts, manage roles, agent access, and track invitations all in one place.', href: '/admin/users', color: 'from-[#00D4FF]/20 to-transparent', icon: Users },
               { title: 'Agent Configuration', desc: 'Create AI agents, adjust logic parameters, and set direct access rights.', href: '/admin/agents', color: 'from-blue-500/20 to-transparent', icon: Bot },
               { title: 'Group Access Control', desc: 'Organize users into logical groups and distribute agent permissions.', href: '/admin/groups', color: 'from-purple-500/20 to-transparent', icon: UsersRound },
               { title: 'Company Management', desc: 'Edit company information, mission, services, and manage administrative assignments.', href: '/admin/company', color: 'from-green-500/20 to-transparent', icon: Building },
               { title: 'Events Management', desc: 'Create and manage events, workshops, and conferences with scheduling and assignments.', href: '/admin/events', color: 'from-orange-500/20 to-transparent', icon: Calendar },
               { title: 'Usage & Time Limits', desc: 'View agent usage per user, set time restrictions, and monitor total minutes per agent.', href: '/admin/usage', color: 'from-yellow-500/20 to-transparent', icon: Activity },
             ].map(({ title, desc, href, color, icon: ModuleIcon }) => (
               <Link key={title} href={href} className="group overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900/40 hover:bg-slate-800/50 transition-all duration-300 relative block hover:shadow-xl hover:shadow-cyan-500/10">
                 <div className={`absolute inset-0 bg-gradient-to-br ${color} opacity-20 group-hover:opacity-30 transition-opacity duration-500`} />
                 <div className="p-8 relative z-10">
                   <div className="bg-slate-800/60 w-12 h-12 rounded-xl flex items-center justify-center mb-6 border border-slate-600/50 group-hover:border-cyan-500/50 transition-all duration-300 cursor-pointer">
                     <ModuleIcon className="h-6 w-6 text-cyan-400 group-hover:text-cyan-300 transition-colors transition-transform duration-200 group-hover:scale-110" />
                   </div>
                   <h3 className="text-xl font-bold text-white mb-3 group-hover:text-cyan-300 transition-colors">{title}</h3>
                   <p className="text-slate-400 leading-relaxed group-hover:text-slate-300 transition-colors">{desc}</p>
                 </div>
               </Link>
             ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
