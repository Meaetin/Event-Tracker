import { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Filter, Zap, Mail, Github, Linkedin } from 'lucide-react';

// Add cache-busting headers
export const metadata: Metadata = {
  title: 'EventScapeSG',
  description: 'Discover events happening around Singapore with our interactive map',
  // Add cache directives
  other: {
    'Cache-Control': 'no-store, max-age=0'
  }
};

// Make the page dynamic to ensure it's not statically generated
export const dynamic = 'force-dynamic';

export default function HomePage() {
  return (
    <>
      <div className='mt-16 md:mt-20 pt-6 md:pt-10 bg-background'>
        {/* Hero Section */}
        <div className="text-center mb-8 md:mb-12 px-4 sm:px-6 lg:px-8">
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4 leading-tight">
            Welcome to <span className="text-primary">EventScape Singapore</span>
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-muted-foreground mb-6 md:mb-8 max-w-3xl mx-auto leading-relaxed">
            Your ultimate guide to discovering exciting events across Singapore. 
            Find concerts, festivals, exhibitions, and more - all in one place!
          </p>
          
          {/* CTA Button */}
          <div className="flex justify-center">
            <Button asChild size="lg" className="text-sm sm:text-base">
              <Link href="/events">
                <MapPin className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                Explore Events
              </Link>
            </Button>
          </div>
        </div>

        {/* Features Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 mb-8 md:mb-12 px-4 sm:px-6 lg:px-8 xl:px-20 py-6 md:py-10">
          <Card className="text-center hover:shadow-lg transition-shadow duration-200">
            <CardHeader>
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-3 sm:mb-4">
                <MapPin className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
              </div>
              <CardTitle className="text-base sm:text-lg">Interactive Map</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-sm sm:text-base leading-relaxed">
                Explore events on an interactive map with detailed markers and popups showing event information.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="text-center hover:shadow-lg transition-shadow duration-200">
            <CardHeader>
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-secondary/50 rounded-lg flex items-center justify-center mx-auto mb-3 sm:mb-4">
                <Filter className="w-5 h-5 sm:w-6 sm:h-6 text-secondary-foreground" />
              </div>
              <CardTitle className="text-base sm:text-lg">Smart Filtering</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-sm sm:text-base leading-relaxed">
                Filter events by category, date, location, and search terms to find exactly what you&apos;re looking for.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="text-center hover:shadow-lg transition-shadow duration-200 md:col-span-2 lg:col-span-1">
            <CardHeader>
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-accent/50 rounded-lg flex items-center justify-center mx-auto mb-3 sm:mb-4">
                <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-accent-foreground" />
              </div>
              <CardTitle className="text-base sm:text-lg">
                AI-Powered
                <Badge variant="secondary" className="ml-2 text-xs">
                  Coming Soon
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-sm sm:text-base leading-relaxed">
                Get personalized event recommendations and discover new experiences tailored to your interests.
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-card border-t border-border">
        <div className="px-4 sm:px-6 lg:px-8 py-8 md:py-12">
          <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {/* About Section */}
            <div className="lg:col-span-1">
              <h3 className="text-lg sm:text-xl font-bold mb-3 md:mb-4 text-foreground">
                EventScape Singapore
              </h3>
              <p className="text-sm sm:text-base text-muted-foreground mb-4 leading-relaxed">
                Your ultimate guide to discovering exciting events across Singapore. 
                From concerts and festivals to exhibitions and workshops - find it all in one place.
              </p>
            </div>

            {/* Connect with me Section */}
            <div className="lg:col-span-1">
              <h4 className="text-base sm:text-lg font-semibold mb-3 md:mb-4 text-foreground">
                Connect with me
              </h4>
              <div className="space-y-3">
                <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                  Have questions or want to suggest an event? I&apos;d love to hear from you!
                </p>
                <div className="flex space-x-4">
                  {/* GitHub */}
                  <Button variant="ghost" size="icon" asChild>
                    <a 
                      href="https://github.com/Meaetin" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      title="GitHub"
                    >
                      <Github className="w-5 h-5" />
                    </a>
                  </Button>

                  {/* LinkedIn */}
                  <Button variant="ghost" size="icon" asChild>
                    <a 
                      href="https://linkedin.com/in/martin-teo" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      title="LinkedIn"
                    >
                      <Linkedin className="w-5 h-5" />
                    </a>
                  </Button>
                </div>
              </div>
            </div>

            {/* Contact Section */}
            <div className="lg:col-span-1">
              <h4 className="text-base sm:text-lg font-semibold mb-3 md:mb-4 text-foreground">
                Contact Me
              </h4>
              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <Mail className="w-4 h-4 sm:w-5 sm:h-5 text-primary mt-0.5 flex-shrink-0" />
                  <a 
                    href="mailto:martinteoyz@gmail.com" 
                    className="text-primary hover:text-primary/80 transition-colors text-sm sm:text-base break-all hover:underline"
                  >
                    martinteoyz@gmail.com
                  </a>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  For general enquiries, partnership opportunities, or technical support.
                </p>
              </div>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="border-t border-border pt-6 md:pt-8 mt-6 md:mt-8">
            <div className="max-w-7xl mx-auto">
              <p className="text-muted-foreground text-xs sm:text-sm text-center">
                © {new Date().getFullYear()} EventScape Singapore. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}