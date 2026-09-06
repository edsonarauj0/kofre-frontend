import { RouterProvider } from "react-router-dom"

import { router } from "@/app/router"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/sonner"

export default function App() {
  return (
    <TooltipProvider>
      <RouterProvider router={router} />
      <Toaster position="bottom-left" />
    </TooltipProvider>
  )
}
