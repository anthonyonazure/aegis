import { 
  Laptop, 
  Shield, 
  Users, 
  ShieldCheck, 
  Mail, 
  FolderOpen, 
  MessageSquare, 
  Eye,
  Github,
  Cloud,
  GitBranch,
  CreditCard,
  TrendingUp,
  Sparkles,
  Server,
  Network,
  HardDrive,
  Database,
  Globe,
  Cpu,
  LucideIcon
} from 'lucide-react';

export const iconMap: Record<string, LucideIcon> = {
  Laptop,
  Shield,
  Users,
  ShieldCheck,
  Mail,
  FolderOpen,
  MessageSquare,
  Eye,
  Github,
  Cloud,
  GitBranch,
  CreditCard,
  TrendingUp,
  Sparkles,
  Server,
  Network,
  HardDrive,
  Database,
  Globe,
  Cpu,
};

export const getIcon = (iconName: string): LucideIcon => {
  return iconMap[iconName] || Shield;
};
