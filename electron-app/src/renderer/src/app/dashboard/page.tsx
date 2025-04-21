import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { useNavigate } from "react-router-dom"

export default function DashboardPage() {
  const navigate = useNavigate()

  return (
    <main className="container mx-auto py-10 px-4 bg-night min-h-screen">
      <Card className="w-full max-w-4xl mx-auto bg-space-cadet border-cool-gray/30 shadow-xl">
        <CardHeader>
          <CardTitle className="text-linen">Minecraft Server Dashboard</CardTitle>
          <CardDescription className="text-cool-gray">Manage your Minecraft server</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="text-linen">
            <p>Your server is running successfully!</p>
            <div className="mt-4">
              <Button onClick={() => navigate("/")} className="bg-linen text-night hover:bg-linen/90">
                Back to Setup
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
