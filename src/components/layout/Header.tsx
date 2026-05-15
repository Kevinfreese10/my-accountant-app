'use client';

import Link from 'next/link';
import { ShoppingCart, LogIn, Menu, ChevronDown } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useRouter, usePathname } from 'next/navigation';
import { useState } from 'react';
import { cn } from '@/lib/utils';

const navGroups = [
  {
    label: 'Accounting',
    href: '/monthly-accounting',
    items: [
        { label: 'Monthly Accounting', href: '/monthly-accounting' },
        { label: 'Cloud Bookkeeping', href: '/ai-accountant' },
        { label: 'All Packages', href: '/products#accounting-services' },
    ]
  },
  {
    label: 'Payroll',
    href: '/monthly-payroll',
    items: [
        { label: 'Monthly Payroll', href: '/monthly-payroll' },
        { label: 'Employee Setup', href: '/products#payroll-services' },
    ]
  },
  {
    label: 'Tax',
    href: '/products#sars-services',
    items: [
      { label: 'Tax Compliance', href: '/compliance' },
      { label: 'SARS Compromises', href: '/sars-compromise' },
      { label: 'SARS Disputes', href: '/sars-disputes' },
      { label: 'Remission of Fines', href: '/remission-of-fines' },
    ],
  },
  {
    label: 'Liquidations',
    href: '/liquidations',
    items: [
        { label: 'Voluntary Liquidations', href: '/liquidations' },
        { label: 'Company Closures', href: '/products#cipc-services' },
    ]
  },
  {
    label: 'Company',
    href: '/about',
    items: [
      { label: 'About Us', href: '/about' },
      { label: 'Tax Tip Blog', href: '/blog' },
      { label: 'Contact Us', href: '/contact' },
    ],
  },
  {
    label: 'Become a Partner',
    href: '/BEI',
    items: [
      { label: 'Partner Program (BEI)', href: '/BEI' },
      { label: 'Franchise Model', href: '/franchise' },
      { label: 'Sign Up', href: '/partner-signup' },
    ],
  },
];

const Header = () => {
  const { itemCount } = useCart();
  const { user, logout, isAuthenticated } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const isAuthPage = pathname === '/login' || pathname === '/signup';

  const handleLogout = () => {
    logout();
    router.push('/');
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background shadow-sm">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-4 lg:gap-8">
          {!isAuthPage && (
            <Link href="/" className="text-2xl font-bold text-gradient shrink-0">
              My Accountant
            </Link>
          )}
          {!isAuthPage && (
            <nav className="hidden items-center gap-1 lg:flex">
              {navGroups.map(group => (
                <DropdownMenu key={group.label}>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-9 px-3 text-sm font-medium hover:bg-transparent hover:text-primary gap-1">
                            {group.label}
                            <ChevronDown className="h-3.5 w-3.5 opacity-50" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-56">
                        {group.items.map(item => (
                            <DropdownMenuItem key={item.label} asChild>
                                <Link href={item.href} className="w-full cursor-pointer">
                                    {item.label}
                                </Link>
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
              ))}
            </nav>
          )}
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          <Button variant="ghost" size="icon" asChild className="relative">
            <Link href="/cart">
              <ShoppingCart className="h-5 w-5" />
              {itemCount > 0 && (
                <Badge className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full p-0 text-xs">
                  {itemCount}
                </Badge>
              )}
              <span className="sr-only">Shopping Cart</span>
            </Link>
          </Button>

          <div className="hidden md:block">
            {isAuthenticated && user ? (
              <UserMenu user={user} onLogout={handleLogout} />
            ) : (
              <Button asChild>
                <Link href="/login">
                  <LogIn className="mr-2 h-4 w-4" /> Portal Login
                </Link>
              </Button>
            )}
          </div>
          
          <div className="lg:hidden">
            {!isAuthPage && (
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Menu className="h-5 w-5" />
                    <span className="sr-only">Open menu</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="flex flex-col h-full">
                  <div className="py-4 border-b">
                    <Link href="/" className="text-2xl font-bold text-primary" onClick={() => setMobileMenuOpen(false)}>
                      My Accountant
                    </Link>
                  </div>
                  <ScrollArea className="flex-1 mt-4">
                    <Accordion type="single" collapsible className="w-full">
                        {navGroups.map((group, index) => (
                            <AccordionItem key={group.label} value={`item-${index}`} className="border-none">
                                <AccordionTrigger className="text-lg font-semibold py-3 hover:no-underline">
                                    {group.label}
                                </AccordionTrigger>
                                <AccordionContent className="pb-4">
                                    <div className="flex flex-col gap-3 pl-4 border-l-2 border-primary/20 ml-1">
                                        {group.items.map(item => (
                                            <Link 
                                                key={item.label} 
                                                href={item.href} 
                                                className="text-base text-muted-foreground hover:text-primary transition-colors"
                                                onClick={() => setMobileMenuOpen(false)}
                                            >
                                                {item.label}
                                            </Link>
                                        ))}
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                  </ScrollArea>
                  <div className="mt-auto pt-6 border-t space-y-4">
                    {isAuthenticated && user ? (
                        <div className="space-y-4">
                            <Link href={user.role === 'partner' ? '/partner/dashboard' : '/admin/dashboard'} className="block text-lg font-medium" onClick={() => setMobileMenuOpen(false)}>Go to Dashboard</Link>
                            <Button onClick={() => { handleLogout(); setMobileMenuOpen(false); }} className="w-full">Logout</Button>
                        </div>
                      ) : (
                        <Button asChild className="w-full" onClick={() => setMobileMenuOpen(false)}>
                          <Link href="/login">
                            <LogIn className="mr-2 h-4 w-4" /> Portal Login
                          </Link>
                        </Button>
                      )}
                  </div>
                </SheetContent>
              </Sheet>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

const UserMenu = ({ user, onLogout }: { user: any; onLogout: () => void }) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" className="relative h-9 w-9 rounded-full bg-primary/10 text-primary font-bold">
        {user.name && <span>{user.name.charAt(0)}</span>}
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent className="w-56" align="end" forceMount>
      <DropdownMenuLabel className="font-normal">
        <div className="flex flex-col space-y-1">
          <p className="text-sm font-medium leading-none">{user.name}</p>
          <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
        </div>
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
       <DropdownMenuItem asChild>
        <Link href={user.role === 'partner' ? '/partner/dashboard' : '/admin/dashboard'}>Dashboard</Link>
      </DropdownMenuItem>
       <DropdownMenuItem asChild>
        <Link href={user.role === 'partner' ? '/partner/profile' : '/admin/staff'}>Profile</Link>
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={onLogout}>
        Log out
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
)

export default Header;
