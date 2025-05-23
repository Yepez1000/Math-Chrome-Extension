"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { FileUp, AlertCircle, Check, Loader2 } from "lucide-react"
import { motion } from "framer-motion"
import { useServerConfigStore } from "@/stores/server-config-store"
import { useModpackSelectionStore } from "@/stores/step-stores"

interface ModpackSelectionStepProps {
  onComplete: () => void
}

export function ModpackSelectionStep({ onComplete }: ModpackSelectionStepProps) {
  const { config, updateConfig } = useServerConfigStore()
  const { selectedTab, setSelectedTab, isUploading, setIsUploading, isValidated, setIsValidated, uploadError, setUploadError } = useModpackSelectionStore()

  const handleFileUpload = async () => {
    setIsUploading(true)
    setUploadError(null)

    try {
      // In a real app, this would use IPC to open a file dialog and validate the modpack
      // const result = await window.electronAPI.selectModpack()

      // Simulate file selection and validation
      await new Promise((resolve) => setTimeout(resolve, 1500))

      // Mock successful validation - always succeed for testing
      const mockResult = {
        valid: true,
        path: "C:\\Downloads\\ftb-revelation-3.5.0.zip",
        name: "FTB Revelation 3.5.0",
      }

      if (mockResult.valid) {
        updateConfig({
          modpackPath: mockResult.path,
          modpackName: mockResult.name,
        })
        setIsValidated(true)
      } else {
        setUploadError(
          "The selected file is not a valid modpack. Please ensure it contains a manifest.json or mods folder.",
        )
      }
    } catch (error) {
      setUploadError("Failed to upload modpack: " + String(error))
    } finally {
      setIsUploading(false)
    }
  }

  const handleSelectModpack = (name: string) => {
    updateConfig({
      modpackPath: `C:\\Downloads\\${name.toLowerCase().replace(/\s+/g, "-")}.zip`,
      modpackName: name,
    })
    setIsValidated(true)
  }

  return (
    <div className="space-y-6">
      <motion.div
        className="text-center mb-6"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h2 className="text-2xl font-bold mb-2 text-linen">Select Modpack</h2>
        <p className="text-cool-gray">
          Choose a modpack for your server. You can upload a zip file or select from popular options.
        </p>
      </motion.div>

      <Tabs defaultValue="upload" value={selectedTab} onValueChange={setSelectedTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-night">
          <TabsTrigger
            value="upload"
            className="data-[state=active]:bg-linen data-[state=active]:text-night text-cool-gray"
          >
            Upload Modpack
          </TabsTrigger>
          <TabsTrigger
            value="browse"
            className="data-[state=active]:bg-linen data-[state=active]:text-night text-cool-gray"
          >
            Browse Popular
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-4 py-4">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card className="border-cool-gray/30 bg-night">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-cool-gray/30 rounded-lg">
                  <motion.div
                    animate={{ y: [0, -5, 0] }}
                    transition={{ duration: 1.5, repeat: Number.POSITIVE_INFINITY, repeatType: "reverse" }}
                  >
                    <FileUp className="h-12 w-12 text-cool-gray mb-4" />
                  </motion.div>
                  <p className="mb-2 text-sm text-cool-gray">Upload a modpack zip file</p>
                  <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                    <Button
                      onClick={handleFileUpload}
                      disabled={isUploading}
                      className="mt-2 bg-linen text-night hover:bg-linen/90"
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        "Select File"
                      )}
                    </Button>
                  </motion.div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {uploadError && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              transition={{ duration: 0.3 }}
            >
              <Alert className="border-cool-gray/30 bg-night">
                <AlertCircle className="h-4 w-4 text-cool-gray" />
                <AlertTitle className="text-linen">Upload Failed</AlertTitle>
                <AlertDescription className="text-cool-gray">{uploadError}</AlertDescription>
              </Alert>
            </motion.div>
          )}

          {isValidated && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              transition={{ duration: 0.3 }}
            >
              <Alert className="border-linen/30 bg-linen/10">
                <Check className="h-4 w-4 text-linen" />
                <AlertTitle className="text-linen">Modpack Validated</AlertTitle>
                <AlertDescription className="text-cool-gray">
                  {config.modpackName} is ready to install.
                </AlertDescription>
              </Alert>
            </motion.div>
          )}
        </TabsContent>

        <TabsContent value="browse" className="py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { name: "FTB Revelation", desc: "Large kitchen-sink modpack with tech and magic" },
              { name: "All The Mods 8", desc: "Comprehensive modpack with a bit of everything" },
              { name: "Create: Above and Beyond", desc: "Create-centered progression pack" },
              { name: "Better Minecraft", desc: "Vanilla+ experience with quality of life improvements" },
            ].map((pack, index) => (
              <motion.div
                key={pack.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + index * 0.1 }}
                whileHover={{ scale: 1.03 }}
              >
                <Card
                  className={`cursor-pointer hover:border-linen ${
                    config.modpackName === pack.name ? "border-linen bg-linen/5" : "border-cool-gray/30 bg-night"
                  }`}
                  onClick={() => handleSelectModpack(pack.name)}
                >
                  <CardContent className="p-4 flex items-center space-x-4">
                    <motion.div
                      className="w-16 h-16 bg-space-cadet rounded flex items-center justify-center overflow-hidden"
                      whileHover={{ rotate: 5 }}
                    >
                      <img src="/placeholder.svg?height=64&width=64" alt={pack.name} className="rounded" />
                    </motion.div>
                    <div>
                      <h3 className="font-medium text-linen">{pack.name}</h3>
                      <p className="text-sm text-cool-gray">{pack.desc}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          <p className="text-center text-sm text-cool-gray mt-4">
            Note: CurseForge API integration coming in a future update
          </p>
        </TabsContent>
      </Tabs>

    </div>
  )
}
