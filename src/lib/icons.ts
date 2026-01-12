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
};

export const getIcon = (iconName: string): LucideIcon => {
  return iconMap[iconName] || Shield;
};
