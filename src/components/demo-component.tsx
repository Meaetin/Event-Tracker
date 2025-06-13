import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function DemoComponent() {
  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-foreground mb-4">
            ShadCN UI with Rose Theme
          </h1>
          <p className="text-muted-foreground">
            Demonstrating the successful migration to ShadCN UI components with the rose color theme
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-primary">Welcome to ShadCN UI</CardTitle>
            <CardDescription>
              This card demonstrates the rose theme implementation with proper color variables
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="demo-input">Demo Input Field</Label>
              <Input 
                id="demo-input" 
                placeholder="Type something here..." 
                className="border-input focus:ring-ring"
              />
            </div>
            
            <div className="flex flex-wrap gap-3">
              <Button variant="default">Primary Button</Button>
              <Button variant="secondary">Secondary Button</Button>
              <Button variant="outline">Outline Button</Button>
              <Button variant="destructive">Destructive Button</Button>
            </div>
            
            <div className="p-4 rounded-lg bg-muted">
              <p className="text-muted-foreground">
                This muted section shows the background and foreground color harmony 
                in the rose theme implementation.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Color Palette Demo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <div className="w-full h-12 bg-primary rounded"></div>
                <p className="text-sm text-center">Primary</p>
              </div>
              <div className="space-y-2">
                <div className="w-full h-12 bg-secondary rounded"></div>
                <p className="text-sm text-center">Secondary</p>
              </div>
              <div className="space-y-2">
                <div className="w-full h-12 bg-accent rounded"></div>
                <p className="text-sm text-center">Accent</p>
              </div>
              <div className="space-y-2">
                <div className="w-full h-12 bg-muted rounded"></div>
                <p className="text-sm text-center">Muted</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 