"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../context/AuthProvider';
import { getUserRole } from '../lib/auth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Navbar() {
  const { user: authUser, isLoading: authLoading, signOut } = useAuth();
  const [role, setRole] = useState<string | null>('user');
  const [mounted, setMounted] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  // Set the mounted flag to true when the component mounts
  useEffect(() => {
    setMounted(true); 
  }, []);

  // Get the user role from the profiles table
  useEffect(() => {
    if (!authLoading && mounted && authUser) {
      getUserRole(authUser, setRole);
    }
  }, [authUser, authLoading, mounted]);

  const handleSignOut = async () => {
    await signOut();
    window.location.href = '/login';
  };

  // Check which page is user on
  const isActive = (path: string) => pathname === path;

  // Navigation items
  const navigationItems = [
    { href: '/', label: 'Home' },
    { href: '/map', label: 'Events Map' },
  ];

  const NavLink = ({ href, children, mobile = false }: { href: string; children: React.ReactNode; mobile?: boolean }) => (
    <Link 
      href={href}
      className={cn(
        mobile ? "block px-3 py-2 text-sm font-medium" : "px-3 py-2 text-sm font-medium",
        "rounded-md transition-colors",
        isActive(href) 
          ? "text-primary bg-primary/10" 
          : "text-foreground hover:text-primary hover:bg-accent"
      )}
      onClick={mobile ? () => setIsMobileMenuOpen(false) : undefined}
    >
      {children}
    </Link>
  );

  return (
    <nav className="bg-background border-b border-border shadow-sm">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-12">
          {/* Logo */}
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Link href="/" className="text-lg font-bold text-primary">
                EventScapeSG
              </Link>
            </div>
            
            {/* Desktop navigation */}
            <div className="hidden md:ml-6 md:flex md:items-center md:space-x-4">
              {navigationItems.map((item) => (
                <NavLink key={item.href} href={item.href}>
                  {item.label}
                </NavLink>
              ))}
              
              {/* AI Event Planning - Coming Soon */}
              <div className="px-3 py-2 rounded-md text-sm font-medium text-muted-foreground cursor-not-allowed relative group">
                AI Event Planning
                <Badge variant="secondary" className="ml-2 text-xs">
                  Coming Soon
                </Badge>
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded border shadow-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                  AI-powered itinerary planning
                </div>
              </div>
              
              {mounted && authUser && (
                <NavLink href="/dashboard">
                  Dashboard
                </NavLink>
              )}
            </div>
          </div>
          
          {/* Desktop auth buttons */}
          <div className="hidden md:flex md:items-center md:space-x-2">
            {mounted && authUser ? (
              <Button
                variant="ghost"
                onClick={handleSignOut}
                className="text-foreground hover:text-primary"
              >
                Sign Out
              </Button>
            ) : mounted && (
              <>
                <NavLink href="/login">
                  Login
                </NavLink>
                <Button asChild>
                  <Link href="/signup">
                    Sign Up
                  </Link>
                </Button>
              </>
            )}
          </div>

          {/* Mobile menu */}
          <div className="md:hidden flex items-center">
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="text-foreground">
                  <Menu className="h-6 w-6" />
                  <span className="sr-only">Open main menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[280px] max-w-[75vw]">
                <SheetTitle className="text-base font-semibold text-primary mb-3">
                  EventScapeSG
                </SheetTitle>
                <div className="flex flex-col space-y-3 mt-4">
                  
                  {navigationItems.map((item) => (
                    <NavLink key={item.href} href={item.href} mobile>
                      {item.label}
                    </NavLink>
                  ))}
                  
                  {/* AI Event Planning - Coming Soon (Mobile) */}
                  <div className="px-3 py-2 rounded-md text-sm font-medium text-muted-foreground">
                    AI Event Planning
                    <Badge variant="secondary" className="ml-2 text-xs">
                      Coming Soon
                    </Badge>
                  </div>
                  
                  {mounted && authUser && (
                    <NavLink href="/dashboard" mobile>
                      {role === 'admin' ? 'Admin Dashboard' : 'Dashboard'}
                    </NavLink>
                  )}

                  {/* Mobile auth section */}
                  <div className="border-t border-border pt-3 mt-3">
                    {mounted && authUser ? (
                      <Button
                        variant="ghost"
                        onClick={() => {
                          handleSignOut();
                          setIsMobileMenuOpen(false);
                        }}
                        className="w-full justify-start text-foreground hover:text-primary"
                      >
                        Sign Out
                      </Button>
                                          ) : mounted && (
                        <div className="space-y-2">
                          <NavLink href="/login" mobile>
                            Login
                          </NavLink>
                          <Button asChild className="w-full" size="sm">
                            <Link 
                              href="/signup"
                              onClick={() => setIsMobileMenuOpen(false)}
                            >
                              Sign Up
                            </Link>
                          </Button>
                        </div>
                      )}
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </nav>
  );
} 