'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  FileText,
  User,
  LogOut,
  ShieldCheck,
  Briefcase,
  Shapes,
  Users,
  ClipboardCheck,
  BookUser,
  Settings,
  ArrowRightLeft,
  Search,
  BookMarked,
  BrainCircuit,
  Images,
  ListOrdered,
  Percent,
  Wrench,
  PanelLeft,
  ChevronDown,
  MessageSquareQuote,
} from 'lucide-react';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import { useAuth } from '@/contexts/AuthContext';
import type { User as UserType } from '@/lib/types';
import { Button } from '../ui/button';
import { useState } from 'react';
import { cn } from '@/lib/utils';

export default function DashboardNav({ user }: { user: UserType }) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();
  const { state, toggleSidebar } = useSidebar();
  const [isSettingsOpen, setIsSettingsOpen] = useState(pathname.startsWith('/admin/settings') || pathname.startsWith('/admin/users') || pathname.startsWith('/admin/staff'));

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  const basePath = user.role === 'client' || user.role === 'ai_accountant'
    ? '/dashboard'
    : user.role === 'partner' || user.role === 'partner_staff'
    ? '/partner'
    : '/admin';

  const navItems = [
     { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['client'] },
     { href: '/dashboard/orders', label: 'My Orders', icon: ShieldCheck, roles: ['client', 'ai_accountant'] },
     { href: '/dashboard/profile', label: 'My Profile', icon: User, roles: ['client'] },
  ];

  const adminNavItems = [
    { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'staff'] },
    { href: '/admin/orders', label: 'Manage Orders', icon: ShieldCheck, roles: ['admin', 'staff'] },
    { href: '/admin/resellers', label: 'Manage Partners', icon: Users, roles: ['admin'] },
    { href: '/admin/clients', label: 'Manage Clients', icon: BookUser, roles: ['admin'] },
    { href: '/admin/ai-accountant/clients', label: 'AI Accountant', icon: BrainCircuit, roles: ['admin', 'staff'] },
    { href: '/admin/services', label: 'Manage Products', icon: Briefcase, roles: ['admin'] },
    { href: '/admin/tools', label: 'Tools', icon: Wrench, roles: ['admin', 'staff'] },
  ];

  const aiAccountantNavItems = [
    { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['ai_accountant'] },
    { href: '/admin/ai-accountant/clients', label: 'AI Accountant', icon: BrainCircuit, roles: ['ai_accountant'] },
  ];
  
  const settingsNavItems = [
    { href: '/admin/profile', label: 'My Profile', icon: User, roles: ['admin', 'staff']},
    { href: '/admin/tasks', label: 'Manage Tasks', icon: ClipboardCheck, roles: ['admin', 'staff'] },
    { href: '/admin/task-templates', label: 'Task Templates', icon: ClipboardCheck, roles: ['admin'] },
    { href: '/admin/categories', label: 'Manage Categories', icon: Shapes, roles: ['admin'] },
    { href: '/admin/blog', label: 'Manage Blog', icon: BookMarked, roles: ['admin'] },
    { href: '/admin/staff', label: 'Manage Staff', icon: Users, roles: ['admin'] },
    { href: '/admin/users', label: 'Manage Users', icon: Users, roles: ['admin'] },
    { href: '/admin/discounts', label: 'Manage Discounts', icon: Percent, roles: ['admin'] },
    { href: '/admin/knowledge-base', label: 'Knowledge Base', icon: BrainCircuit, roles: ['admin'] },
    { href: '/admin/ai-accountant/allocation-rules', label: 'Allocation Rules', icon: ArrowRightLeft, roles: ['admin'] },
    { href: '/admin/ai-accountant/chart-of-accounts', label: 'Chart of Accounts', icon: ListOrdered, roles: ['admin']},
    { href: '/admin/media', label: 'Media', icon: Images, roles: ['admin'] },
    { href: '/admin/seo', label: 'SEO Management', icon: Search, roles: ['admin'] },
  ];

  const partnerNavItems = [
    { href: '/partner/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['partner', 'partner_staff'] },
    { href: '/partner/services', label: 'View Products', icon: Briefcase, roles: ['partner', 'partner_staff'] },
    { href: '/partner/orders', label: 'Client Orders', icon: ShieldCheck, roles: ['partner', 'partner_staff'] },
    { href: '/partner/outsourced-orders', label: 'Outsourced Orders', icon: FileText, roles: ['partner', 'partner_staff'] },
    { href: '/partner/clients', label: 'Manage Clients', icon: BookUser, roles: ['partner', 'partner_staff'] },
    { href: '/partner/tasks', label: 'Manage Tasks', icon: ClipboardCheck, roles: ['partner', 'partner_staff'] },
    { href: '/partner/staff', label: 'Manage Staff', icon: Users, roles: ['partner'] },
    { href: '/partner/tools', label: 'Tools', icon: Wrench, roles: ['partner', 'partner_staff'] },
    { href: '/partner/profile', label: 'My Profile', icon: User, roles: ['partner', 'partner_staff'] },
  ];

  const hasAIAccountantAccess = user.hasNumeraProfile || user.source === 'AI Accountant' || (user.sharedWith && user.sharedWith.length > 0);
  
  const visibleNavItems = navItems.filter(item => item.roles.includes(user.role));
  const visibleAdminNavItems = adminNavItems.filter(item => item.roles.includes(user.role));
  const visibleAiAccountantNavItems = aiAccountantNavItems.filter(item => item.roles.includes(user.role));
  const visibleSettingsNavItems = settingsNavItems.filter(item => item.roles.includes(user.role));
  const visiblePartnerNavItems = partnerNavItems.filter(item => item.roles.includes(user.role));

  return (
    <>
      <SidebarHeader>
        <div className={cn("flex items-center gap-3 p-2", state === 'collapsed' && 'p-0')}>
            <div className={cn("flex-1 overflow-hidden", state === 'collapsed' && 'hidden')}>
                <p className="font-semibold text-sm truncate">{user.companyName || user.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{user.role.replace('_', ' ')}</p>
            </div>
             <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={toggleSidebar}
            >
                <PanelLeft className={cn("transition-transform", state === 'collapsed' && 'rotate-180')} />
            </Button>
        </div>
      </SidebarHeader>

      <SidebarMenu className="flex-1">
        
        {(user.role === 'client') && visibleNavItems.map((item) => (
            <SidebarMenuItem key={item.label}>
            <SidebarMenuButton asChild isActive={pathname.startsWith(item.href)} tooltip={item.label}>
                <Link href={item.href}>
                <item.icon />
                <span>{item.label}</span>
                </Link>
            </SidebarMenuButton>
            </SidebarMenuItem>
        ))}
        
        {(hasAIAccountantAccess && (user.role === 'client')) && (
             <>
             <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname.startsWith(`${basePath}/ai-accountant`) && !pathname.includes('/chat')} tooltip="AI Accountant">
                    <Link href={`${basePath}/ai-accountant/clients`}>
                        <BrainCircuit />
                        <span>AI Accountant</span>
                    </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname.includes('/chat')} tooltip="Transaction Chat">
                    <Link href={`/dashboard/ai-accountant/${user.uid}/chat`}>
                        <MessageSquareQuote />
                        <span>Transaction Chat</span>
                    </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
            </>
        )}

        {user.role === 'ai_accountant' && visibleAiAccountantNavItems.map((item) => (
            <SidebarMenuItem key={item.label}>
                <SidebarMenuButton asChild isActive={pathname.startsWith(item.href)} tooltip={item.label}>
                <Link href={item.href}>
                    <item.icon />
                    <span>{item.label}</span>
                </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
        ))}
        
        {(user.role === 'admin' || user.role === 'staff') && visibleAdminNavItems.map((item) => (
            <SidebarMenuItem key={item.label}>
                <SidebarMenuButton asChild isActive={pathname.startsWith(item.href)} tooltip={item.label}>
                <Link href={item.href}>
                    <item.icon />
                    <span>{item.label}</span>
                </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
        ))}

        {(user.role === 'partner' || user.role === 'partner_staff') && (
            <>
            {visiblePartnerNavItems.map((item) => (
                <SidebarMenuItem key={item.label}>
                <SidebarMenuButton asChild isActive={pathname === item.href} tooltip={item.label}>
                    <Link href={item.href}>
                    <item.icon />
                    <span>{item.label}</span>
                    </Link>
                </SidebarMenuButton>
                </SidebarMenuItem>
            ))}
            <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname.includes('/chat')} tooltip="Transaction Chat">
                    <Link href={`/dashboard/ai-accountant/${user.uid}/chat`}>
                        <MessageSquareQuote />
                        <span>Transaction Chat</span>
                    </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
            </>
        )}

        
        {(user.role === 'admin' || user.role === 'staff') && (
            <Collapsible open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                    <SidebarMenuButton isActive={pathname.startsWith('/admin/settings') || pathname.startsWith('/admin/users') || pathname.startsWith('/admin/profile')} tooltip="Settings">
                    <Settings />
                    <span>Settings</span>
                    <ChevronDown className="ml-auto h-4 w-4 shrink-0 transition-transform duration-200 group-[[data-state=open]]:rotate-180" />
                    </SidebarMenuButton>
                </CollapsibleTrigger>
                </SidebarMenuItem>
                <CollapsibleContent asChild>
                <SidebarMenu className="pl-4">
                    {visibleSettingsNavItems.map(item => (
                    <SidebarMenuItem key={item.label}>
                        <SidebarMenuButton asChild isActive={pathname === item.href} tooltip={item.label} className="h-8">
                        <Link href={item.href}>
                            <item.icon />
                            <span>{item.label}</span>
                        </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    ))}
                </SidebarMenu>
                </CollapsibleContent>
            </Collapsible>
        )}
      </SidebarMenu>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleLogout} tooltip="Log Out">
              <LogOut />
              <span>Log Out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </>
  );
}
