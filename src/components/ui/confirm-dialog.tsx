"use client"

import { useState, useCallback, useRef, useMemo, useEffect, createContext, useContext, ReactNode } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

type DialogMode = "confirm" | "alert" | null

interface ConfirmOptions {
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  destructive?: boolean
}

interface AlertOptions {
  title: string
  description: string
  variant?: "default" | "success" | "error"
}

interface ConfirmDialogContextType {
  showConfirm: (options: ConfirmOptions) => Promise<boolean>
  showAlert: (options: AlertOptions) => Promise<void>
}

const ConfirmDialogContext = createContext<ConfirmDialogContextType | null>(null)

export function useConfirmDialog() {
  const context = useContext(ConfirmDialogContext)
  if (!context) {
    throw new Error("useConfirmDialog must be used within ConfirmDialogProvider")
  }
  return context
}

interface ConfirmDialogProviderProps {
  children: ReactNode
}

export function ConfirmDialogProvider({ children }: ConfirmDialogProviderProps) {
  const [mode, setMode] = useState<DialogMode>(null)
  const [confirmOptions, setConfirmOptions] = useState<ConfirmOptions>({ title: "", description: "" })
  const [alertOptions, setAlertOptions] = useState<AlertOptions>({ title: "", description: "" })

  const confirmResolveRef = useRef<((value: boolean) => void) | null>(null)
  const alertResolveRef = useRef<(() => void) | null>(null)
  const modeRef = useRef<DialogMode>(null)

  // Keep modeRef in sync with current mode via effect (not during render)
  useEffect(() => {
    modeRef.current = mode
  }, [mode])

  const showConfirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      confirmResolveRef.current = resolve
      setConfirmOptions(options)
      setMode("confirm")
    })
  }, [])

  const showAlert = useCallback((options: AlertOptions): Promise<void> => {
    return new Promise((resolve) => {
      alertResolveRef.current = resolve
      setAlertOptions(options)
      setMode("alert")
    })
  }, [])

  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) {
      const currentMode = modeRef.current
      if (currentMode === "confirm" && confirmResolveRef.current) {
        confirmResolveRef.current(false)
        confirmResolveRef.current = null
      } else if (currentMode === "alert" && alertResolveRef.current) {
        alertResolveRef.current()
        alertResolveRef.current = null
      }
      setMode(null)
    }
  }, [])

  const handleConfirmAction = useCallback(() => {
    if (confirmResolveRef.current) {
      confirmResolveRef.current(true)
      confirmResolveRef.current = null
    }
    setMode(null)
  }, [])

  const handleAlertAction = useCallback(() => {
    if (alertResolveRef.current) {
      alertResolveRef.current()
      alertResolveRef.current = null
    }
    setMode(null)
  }, [])

  const isConfirm = mode === "confirm"
  const variant = !isConfirm ? alertOptions.variant : undefined

  const contextValue = useMemo(() => ({ showConfirm, showAlert }), [showConfirm, showAlert])

  return (
    <ConfirmDialogContext.Provider value={contextValue}>
      {children}
      
      <Dialog open={mode !== null} onOpenChange={handleOpenChange}>
        <DialogContent aria-describedby="confirm-dialog-description">
          <DialogHeader>
            <DialogTitle className={variant === "error" ? "text-destructive" : variant === "success" ? "text-green-600" : ""}>
              {isConfirm ? confirmOptions.title : alertOptions.title}
            </DialogTitle>
            <DialogDescription id="confirm-dialog-description">{isConfirm ? confirmOptions.description : alertOptions.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            {isConfirm ? (
              <>
                <Button variant="outline" onClick={() => handleOpenChange(false)}>
                  {confirmOptions.cancelText || "Cancel"}
                </Button>
                <Button
                  onClick={handleConfirmAction}
                  className={confirmOptions.destructive ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : undefined}
                >
                  {confirmOptions.confirmText || "Confirm"}
                </Button>
              </>
            ) : (
              <Button onClick={handleAlertAction}>OK</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmDialogContext.Provider>
  )
}
