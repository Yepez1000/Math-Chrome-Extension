"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { useServerStore } from "@/lib/store"
import { Plus, Clock, Calendar, Power, PowerOff, Edit, Trash2 } from "lucide-react"
import { TaskCreationForm } from "./task-creation-form"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { ScheduledTask } from "@/lib/store"

export function SchedulerManagement() {
  const { toast } = useToast()
  const { scheduledTasks, toggleTaskEnabled, deleteScheduledTask } = useServerStore()
  const [isCreatingTask, setIsCreatingTask] = useState(false)
  const [editingTask, setEditingTask] = useState<ScheduledTask | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null)

  const handleCreateTask = () => {
    setIsCreatingTask(true)
    setEditingTask(null)
  }

  const handleEditTask = (task: ScheduledTask) => {
    setEditingTask(task)
    setIsCreatingTask(true)
  }

  const handleCloseForm = () => {
    setIsCreatingTask(false)
    setEditingTask(null)
  }

  const handleToggleTask = (id: string) => {
    toggleTaskEnabled(id)
    toast({
      title: "Task updated",
      description: "Task status has been updated.",
    })
  }

  const handleDeleteTask = (id: string) => {
    setTaskToDelete(id)
    setDeleteDialogOpen(true)
  }

  const confirmDeleteTask = () => {
    if (taskToDelete) {
      deleteScheduledTask(taskToDelete)
      setDeleteDialogOpen(false)
      setTaskToDelete(null)
      toast({
        title: "Task deleted",
        description: "The scheduled task has been deleted.",
      })
    }
  }

  // Format time to be more readable
  const formatTime = (time: string) => {
    const [hours, minutes, seconds] = time.split(":")
    const h = Number.parseInt(hours)
    const period = h >= 12 ? "PM" : "AM"
    const hour12 = h % 12 || 12
    return `${hour12}:${minutes}:${seconds} ${period}`
  }

  return (
    <div className="space-y-6">
      {isCreatingTask ? (
        <TaskCreationForm task={editingTask} onClose={handleCloseForm} />
      ) : (
        <>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 className="text-xl font-bold text-linen">Task Scheduler</h2>
              <p className="text-cool-gray">Schedule commands to run automatically on your server</p>
            </div>

            <Button onClick={handleCreateTask} className="bg-linen text-night hover:bg-linen/90">
              <Plus className="mr-2 h-4 w-4" />
              Create New Task
            </Button>
          </div>

          <Card className="border-cool-gray/30 bg-space-cadet shadow-lg">
            <CardContent className="p-0">
              {scheduledTasks.length > 0 ? (
                <div className="rounded overflow-hidden">
                  <Table>
                    <TableHeader className="bg-night">
                      <TableRow>
                        <TableHead className="text-linen">Task Name</TableHead>
                        <TableHead className="text-linen">Time</TableHead>
                        <TableHead className="text-linen">Repeat</TableHead>
                        <TableHead className="text-linen">Status</TableHead>
                        <TableHead className="text-linen">Next Run</TableHead>
                        <TableHead className="text-linen text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {scheduledTasks.map((task) => (
                        <TableRow key={task.id} className="border-cool-gray/20 hover:bg-night/50">
                          <TableCell className="font-medium text-linen">{task.name}</TableCell>
                          <TableCell className="text-cool-gray">
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-cool-gray" />
                              {formatTime(task.time)}
                            </div>
                          </TableCell>
                          <TableCell className="text-cool-gray">
                            {task.repeat ? (
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-cool-gray" />
                                Daily
                              </div>
                            ) : (
                              <span className="text-cool-gray">Once</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={`${
                                task.enabled
                                  ? "bg-green-500/20 text-green-400 border-green-500/50"
                                  : "bg-red-500/20 text-red-400 border-red-500/50"
                              } border`}
                            >
                              {task.enabled ? "Enabled" : "Disabled"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-cool-gray">{task.nextRun}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleToggleTask(task.id)}
                                className="h-8 border-cool-gray/30 text-linen hover:bg-night/50"
                                title={task.enabled ? "Disable Task" : "Enable Task"}
                              >
                                {task.enabled ? (
                                  <PowerOff className="h-4 w-4 text-red-400" />
                                ) : (
                                  <Power className="h-4 w-4 text-green-400" />
                                )}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditTask(task)}
                                className="h-8 border-cool-gray/30 text-linen hover:bg-night/50"
                                title="Edit Task"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteTask(task.id)}
                                className="h-8 border-cool-gray/30 text-red-400 hover:bg-night/50"
                                title="Delete Task"
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
                  <Clock className="h-12 w-12 text-cool-gray mx-auto mb-4" />
                  <h3 className="text-linen font-medium mb-1">No scheduled tasks</h3>
                  <p className="text-cool-gray">Create a task to automate server commands</p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="bg-space-cadet border-cool-gray/30 text-linen">
          <DialogHeader>
            <DialogTitle>Delete Task</DialogTitle>
            <DialogDescription className="text-cool-gray">
              Are you sure you want to delete this scheduled task? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              className="border-cool-gray text-linen hover:bg-cool-gray/10"
            >
              Cancel
            </Button>
            <Button onClick={confirmDeleteTask} className="bg-red-600 hover:bg-red-700 text-white">
              Delete Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
