"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { motion } from "framer-motion"
import { useServerStore } from "@/lib/store"
import { Download, RotateCcw, Trash2, Archive, Clock, AlertTriangle, Loader2 } from "lucide-react"
import type { BackupData, BackupFrequency } from "@/lib/store"

export function BackupManagement() {
  const { toast } = useToast()
  const {
    backups,
    isBackingUp,
    autoBackupEnabled,
    backupFrequency,
    maxBackupsToKeep,
    createBackup,
    deleteBackup,
    restoreBackup,
    setAutoBackupEnabled,
    setBackupFrequency,
    setMaxBackupsToKeep,
    status,
  } = useServerStore()

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false)
  const [selectedBackup, setSelectedBackup] = useState<BackupData | null>(null)
  const [isRestoring, setIsRestoring] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleBackupNow = async () => {
    try {
      await createBackup()
      toast({
        title: "Backup created",
        description: "Server backup completed successfully.",
      })
    } catch (error) {
      toast({
        title: "Backup failed",
        description: String(error),
        variant: "destructive",
      })
    }
  }

  const handleDeleteBackup = async () => {
    if (!selectedBackup) return

    setIsDeleting(true)
    try {
      await deleteBackup(selectedBackup.id)
      toast({
        title: "Backup deleted",
        description: `${selectedBackup.name} has been deleted.`,
      })
      setDeleteDialogOpen(false)
    } catch (error) {
      toast({
        title: "Delete failed",
        description: String(error),
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
      setSelectedBackup(null)
    }
  }

  const handleRestoreBackup = async () => {
    if (!selectedBackup) return

    setIsRestoring(true)
    try {
      await restoreBackup(selectedBackup.id)
      toast({
        title: "Backup restored",
        description: `Server has been restored to ${selectedBackup.name}.`,
      })
      setRestoreDialogOpen(false)
    } catch (error) {
      toast({
        title: "Restore failed",
        description: String(error),
        variant: "destructive",
      })
    } finally {
      setIsRestoring(false)
      setSelectedBackup(null)
    }
  }

  const handleDownloadBackup = (backup: BackupData) => {
    // In a real app, this would trigger a file download
    toast({
      title: "Download started",
      description: `Downloading ${backup.name}...`,
    })
  }

  const getFrequencyLabel = (freq: BackupFrequency): string => {
    switch (freq) {
      case "hourly":
        return "Every Hour"
      case "every6hours":
        return "Every 6 Hours"
      case "daily":
        return "Daily"
      case "weekly":
        return "Weekly"
      default:
        return "Custom"
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-linen">Backup Management</h2>
          <p className="text-cool-gray">Create, restore, and manage server backups</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Backup Now Panel */}
        <Card className="border-cool-gray/30 bg-space-cadet shadow-lg lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-linen">Create Backup</CardTitle>
            <CardDescription className="text-cool-gray">Create a manual backup of your server</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-cool-gray text-sm">
                This will create a complete backup of your server, including world data, player data, and configuration
                files.
              </p>
              <Button
                onClick={handleBackupNow}
                disabled={isBackingUp || status !== "online"}
                className="w-full bg-linen text-night hover:bg-linen/90"
              >
                {isBackingUp ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating Backup...
                  </>
                ) : (
                  <>
                    <Archive className="mr-2 h-4 w-4" />
                    Backup Server Now
                  </>
                )}
              </Button>
              {status !== "online" && (
                <p className="text-yellow-400 text-xs flex items-center">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Server must be online to create backups
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Auto Backup Settings */}
        <Card className="border-cool-gray/30 bg-space-cadet shadow-lg lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-linen">Auto-Backup Settings</CardTitle>
            <CardDescription className="text-cool-gray">Configure automatic backup schedule</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-linen">Enable Automatic Backups</Label>
                  <p className="text-cool-gray text-xs">Automatically create backups on a schedule</p>
                </div>
                <Switch
                  checked={autoBackupEnabled}
                  onCheckedChange={setAutoBackupEnabled}
                  className="data-[state=checked]:bg-linen data-[state=checked]:text-night"
                />
              </div>

              {autoBackupEnabled && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-4 pt-4 border-t border-cool-gray/20"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="backup-frequency" className="text-linen">
                        Backup Frequency
                      </Label>
                      <Select
                        value={backupFrequency}
                        onValueChange={(value) => setBackupFrequency(value as BackupFrequency)}
                      >
                        <SelectTrigger id="backup-frequency" className="bg-night border-cool-gray/30 text-linen">
                          <SelectValue placeholder="Select frequency" />
                        </SelectTrigger>
                        <SelectContent className="bg-space-cadet border-cool-gray/30 text-linen">
                          <SelectItem value="hourly" className="hover:bg-night/50 focus:bg-night/50 focus:text-linen">
                            Every Hour
                          </SelectItem>
                          <SelectItem
                            value="every6hours"
                            className="hover:bg-night/50 focus:bg-night/50 focus:text-linen"
                          >
                            Every 6 Hours
                          </SelectItem>
                          <SelectItem value="daily" className="hover:bg-night/50 focus:bg-night/50 focus:text-linen">
                            Daily
                          </SelectItem>
                          <SelectItem value="weekly" className="hover:bg-night/50 focus:bg-night/50 focus:text-linen">
                            Weekly
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="max-backups" className="text-linen">
                        Max Backups to Keep
                      </Label>
                      <Input
                        id="max-backups"
                        type="number"
                        min={1}
                        max={50}
                        value={maxBackupsToKeep}
                        onChange={(e) => {
                          const value = Number.parseInt(e.target.value)
                          if (!isNaN(value) && value >= 1 && value <= 50) {
                            setMaxBackupsToKeep(value)
                          }
                        }}
                        className="bg-night border-cool-gray/30 text-linen"
                      />
                    </div>
                  </div>

                  <div className="bg-night/50 p-3 rounded border border-cool-gray/30 text-cool-gray text-sm">
                    <div className="flex items-start gap-2">
                      <Clock className="h-4 w-4 mt-0.5 text-linen" />
                      <div>
                        <p>
                          <span className="text-linen">Next backup:</span>{" "}
                          {new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleString()}
                        </p>
                        <p className="mt-1 text-xs">
                          Auto backups save your server automatically at set intervals. Oldest backups will be deleted
                          when the limit is reached.
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Backup List */}
        <Card className="border-cool-gray/30 bg-space-cadet shadow-lg lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-linen">Backup History</CardTitle>
            <CardDescription className="text-cool-gray">Manage your existing backups</CardDescription>
          </CardHeader>
          <CardContent>
            {backups.length > 0 ? (
              <div className="rounded border border-cool-gray/30 overflow-hidden">
                <Table>
                  <TableHeader className="bg-night">
                    <TableRow>
                      <TableHead className="text-linen">Backup Name</TableHead>
                      <TableHead className="text-linen">Date</TableHead>
                      <TableHead className="text-linen">Size</TableHead>
                      <TableHead className="text-linen">Type</TableHead>
                      <TableHead className="text-linen text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {backups.map((backup) => (
                      <TableRow key={backup.id} className="border-cool-gray/20 hover:bg-night/50">
                        <TableCell className="font-medium text-linen">{backup.name}</TableCell>
                        <TableCell className="text-cool-gray">{backup.timestamp}</TableCell>
                        <TableCell className="text-cool-gray">{backup.size}</TableCell>
                        <TableCell className="text-cool-gray">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              backup.type === "auto" ? "bg-blue-500/20 text-blue-400" : "bg-green-500/20 text-green-400"
                            }`}
                          >
                            {backup.type === "auto" ? "Auto" : "Manual"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDownloadBackup(backup)}
                              className="h-8 border-cool-gray/30 text-linen hover:bg-night/50"
                              title="Download Backup"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedBackup(backup)
                                setRestoreDialogOpen(true)
                              }}
                              className="h-8 border-cool-gray/30 text-linen hover:bg-night/50"
                              title="Restore Backup"
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedBackup(backup)
                                setDeleteDialogOpen(true)
                              }}
                              className="h-8 border-cool-gray/30 text-red-400 hover:bg-night/50"
                              title="Delete Backup"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12 border border-cool-gray/30 rounded-md bg-night/50">
                <Archive className="h-12 w-12 text-cool-gray mx-auto mb-4" />
                <h3 className="text-linen font-medium mb-1">No backups yet</h3>
                <p className="text-cool-gray">Press 'Backup Now' to create your first save!</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="bg-space-cadet border-cool-gray/30 text-linen">
          <DialogHeader>
            <DialogTitle>Delete Backup</DialogTitle>
            <DialogDescription className="text-cool-gray">
              Are you sure you want to delete this backup? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {selectedBackup && (
              <div className="bg-night/50 p-3 rounded border border-cool-gray/30 text-cool-gray">
                <p className="text-linen font-medium">{selectedBackup.name}</p>
                <p className="text-sm">Created: {selectedBackup.timestamp}</p>
                <p className="text-sm">Size: {selectedBackup.size}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              className="border-cool-gray text-linen hover:bg-cool-gray/10"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteBackup}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Backup
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restore Confirmation Dialog */}
      <Dialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <DialogContent className="bg-space-cadet border-cool-gray/30 text-linen">
          <DialogHeader>
            <DialogTitle>Restore Backup</DialogTitle>
            <DialogDescription className="text-cool-gray">
              Are you sure you want to restore this backup? This will overwrite your current world and server data.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {selectedBackup && (
              <div className="bg-night/50 p-3 rounded border border-cool-gray/30 text-cool-gray">
                <p className="text-linen font-medium">{selectedBackup.name}</p>
                <p className="text-sm">Created: {selectedBackup.timestamp}</p>
                <p className="text-sm">Size: {selectedBackup.size}</p>
              </div>
            )}
            <div className="mt-4 bg-yellow-500/10 p-3 rounded border border-yellow-500/30 text-yellow-400 text-sm">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5" />
                <div>
                  <p className="font-medium">Warning</p>
                  <p className="mt-1">
                    The server will be stopped during restoration and restarted afterward. All current world data will
                    be replaced.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRestoreDialogOpen(false)}
              className="border-cool-gray text-linen hover:bg-cool-gray/10"
            >
              Cancel
            </Button>
            <Button
              onClick={handleRestoreBackup}
              disabled={isRestoring}
              className="bg-linen text-night hover:bg-linen/90"
            >
              {isRestoring ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Restoring...
                </>
              ) : (
                <>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Restore Backup
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
