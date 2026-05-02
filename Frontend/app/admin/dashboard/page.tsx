'use client';

import Link from 'next/link';
import DashboardLayout from '@/components/dashboard-layout';
import { Users, Bot, Shield, Activity, UsersRound, ArrowRight, Building, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useAuth } from '@/lib/auth-context';
import { useQuery } from '@tanstack/react-query';
import { organizationsApi } from '@/lib/api-client';

export default function AdminDashboardPage() {
  const { user } = useAuth();

  const { data: stats } = useQuery({
    queryKey: ['org', 'stats'],
    queryFn: organizationsApi.getMyOrgStats,
  });

  const metricCards = [
    { label: 'Total Members',     value: stats?.member_count,           icon: Users,     color: 'text-cyan-400',   bg: 'bg-cyan-500/10',   href: '/admin/users'  },
    { label: 'Active Agents',    value: stats?.subscribed_agent_count, icon: Bot,       color: 'text-blue-400',   bg: 'bg-blue-500/10',   href: '/admin/organization' },
    { label: 'Work Groups',       value: stats?.group_count,            icon: UsersRound,color: 'text-purple-400', bg: 'bg-purple-500/10', href: '/admin/groups' },
    { label: 'System Health',    value: 'Optimal',                     icon: Activity,  color: 'text-emerald-400',bg: 'bg-emerald-500/10',href: null            },
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
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
               { title: 'User Directory', desc: 'Manage member accounts, permissions, and organizational hierarchy.', href: '/admin/users', icon: Users, color: 'cyan' },
               { title: 'Agent Console', desc: 'Configure AI behaviors, subscription status, and access controls.', href: '/admin/agents', icon: Bot, color: 'blue' },
               { title: 'Work Groups', desc: 'Group members and assign collective agent permissions efficiently.', href: '/admin/groups', icon: UsersRound, color: 'purple' },
               { title: 'Company Hub', desc: 'Customize organizational identity, mission statements, and core services.', href: '/admin/company', icon: Building, color: 'emerald' },
               { title: 'Events Engine', desc: 'Schedule, manage, and track workshops, conferences, and assignments.', href: '/admin/events', icon: Calendar, color: 'orange' },
               { title: 'Integrations', desc: 'Connect third-party services, manage API keys, and Gmail OAuth settings.', href: '/admin/integrations', icon: Plug, color: 'indigo' },
             ].map(({ title, desc, href, icon: Icon, color }) => (
               <Link key={title} href={href} className="group p-1 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 transition-all duration-300">
                 <div className="bg-[#020B18]/60 p-6 rounded-[14px] h-full transition-colors group-hover:bg-[#020B18]/80">
                   <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-6 bg-${color}-500/10 border border-${color}-500/20 group-hover:scale-110 transition-transform duration-300`}>
                     <Icon className={`h-6 w-6 text-${color}-400`} />
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
