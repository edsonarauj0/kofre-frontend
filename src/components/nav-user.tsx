import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  IconBell,
  IconCreditCard,
  IconLogout,
  IconMoon,
  IconRosetteDiscountCheck,
  IconSelector,
  IconSettings,
  IconSparkles,
  IconSun,
} from "@tabler/icons-react"
import { useAuth } from "@/app/auth"
import { obterIniciais } from "@/shared/lib/formatadores"
import { NavLink } from "react-router-dom"
import { Button } from "./ui/button"
import { useTheme } from "./theme-provider"
import { Badge } from "./ui/badge"

export function NavUser({
  user,
}: {
  user: {
    name: string
    email: string
    avatar: string
  }
}) {
  const { isMobile } = useSidebar()
  const { sair } = useAuth()
  const { theme, setTheme } = useTheme()

  return (
    <>
      <div className="flex items-center gap-2 px-2">
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() =>
            setTheme(theme === "dark" ? "light" : "dark")
          }
          aria-label="Alternar tema"
        >
          {theme === "dark" ? <IconSun /> : <IconMoon />}
        </Button>
        <Button variant="outline" size="icon-sm" aria-label="Notificacoes">
          <IconBell />
        </Button>
        <Badge variant="secondary">3 novas</Badge>
      </div>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user.avatar} alt={user.name} />
                  <AvatarFallback>
                    {obterIniciais(user.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="truncate text-xs">{user.email}</span>
                </div>
                <IconSelector className="ml-auto size-4" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-md"
              side={isMobile ? "bottom" : "right"}
              align="end"
              sideOffset={4}
            >
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.avatar} alt={user.name} />
                    <AvatarFallback >
                      {obterIniciais(user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{user.name}</span>
                    <span className="truncate text-xs">{user.email}</span>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem>
                  <IconSparkles
                  />
                  Upgrade to Pro
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <NavLink to={"/conta"}>
                  <DropdownMenuItem>
                    <IconRosetteDiscountCheck
                    />
                    Conta
                  </DropdownMenuItem>
                </NavLink>
                <NavLink to={"/configuracoes"}>
                  <DropdownMenuItem>
                    <IconSettings
                    />
                    Configurações
                  </DropdownMenuItem>
                </NavLink>
                <DropdownMenuItem>
                  <IconCreditCard
                  />
                  Billing
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <IconBell
                  />
                  Notifications
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => void sair()}>
                <IconLogout
                />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
    </>
  )
}
