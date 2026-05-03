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
      <div className="flex flex-col gap-10 max-w-7xl mx-auto">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 to-slate-950 border border-white/5 p-8 md:p-10">
          <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4 w-96 h-96 bg-cyan-500/10 blur-[100px] pointer-events-none" />
          <div className="relative z-10">
            <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white mb-4">
              Dashboard <span className="text-cyan-400">Overview</span>
            </h1>
            <p className="text-base md:text-lg text-slate-400 max-w-2xl leading-relaxed">
              Welcome back, <span className="text-white font-bold">{user?.email?.split('@')[0]}</span>. Your platform is currently <span className="text-emerald-400 font-semibold italic">fully operational</span> with all systems healthy.
            </p>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {metricCards.map(({ label, value, icon: Icon, color, bg, href }) => {
            const cardContent = (
              <Card className="h-full bg-slate-900/40 backdrop-blur-md border border-white/5 hover:border-cyan-500/30 transition-all duration-500 group relative overflow-hidden rounded-2xl">
                <div className={`absolute top-0 right-0 p-8 opacity-5 transition-transform duration-500 group-hover:scale-150 group-hover:rotate-12 ${color}`}>
                  <Icon className="h-24 w-24" />
                </div>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className={`p-2.5 rounded-xl ${bg} border border-white/5`}>
                      <Icon className={`h-5 w-5 ${color}`} />
                    </div>
                    {href && (
                      <div className="p-1 rounded-full bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                      </div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="text-3xl font-black tracking-tighter text-white">
                      {value ?? '0'}
                    </div>
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-500 group-hover:text-slate-300 transition-colors">
                      {label}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );

            return href ? (
              <Link key={label} href={href} className="block transition-transform hover:-translate-y-1">
                {cardContent}
              </Link>
            ) : (
              <div key={label}>{cardContent}</div>
            );
          })}
        </div>

        {/* Administrative Modules */}
        <div className="space-y-8">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold text-white tracking-tight">Administrative Modules</h2>
            <div className="h-px flex-1 bg-white/5" />
          </div>
          
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
                   <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                     {title}
                     <ArrowRight className="h-4 w-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-cyan-400" />
                   </h3>
                   <p className="text-sm text-slate-400 leading-relaxed line-clamp-2">{desc}</p>
                 </div>
               </Link>
             ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
