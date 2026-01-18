import { motion } from 'framer-motion';
import { Shield, Award, Globe, CheckCircle } from 'lucide-react';

const certifications = [
  {
    id: 'iso-27001-27018',
    title: 'ISO 27001 & ISO 27018',
    description: 'Information Security Management',
    icon: Shield,
    badges: ['27001', '27018']
  },
  {
    id: 'soc-2-3',
    title: 'SOC 2, Type II & SOC 3',
    description: 'Service Organization Controls',
    icon: Award,
    badges: ['SOC']
  },
  {
    id: 'iso-9001',
    title: 'ISO 9001 Certification',
    description: 'Quality Management System',
    icon: Globe,
    badges: ['9001']
  },
  {
    id: 'irap',
    title: 'IRAP',
    description: 'Information Security Registered Assessors Program',
    icon: CheckCircle,
    badges: ['IRAP']
  }
];

export const SecurityComplianceBadges = () => {
  return (
    <div className="py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <h2 className="text-2xl md:text-3xl font-bold text-foreground">
          Ensuring unmatched M365{' '}
          <span className="text-pink-500">security</span>
          {' '}and{' '}
          <span className="text-cyan-400">compliance</span>
        </h2>
      </div>

      {/* Certification Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {certifications.map((cert, index) => {
          const Icon = cert.icon;
          return (
            <motion.div
              key={cert.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="group"
            >
              <div className="relative bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-6 hover:border-primary/30 transition-all duration-300">
                {/* Badge/Icon Display */}
                <div className="flex flex-col items-center justify-center mb-4">
                  <div className="relative">
                    {cert.badges.length > 1 ? (
                      <div className="flex items-center gap-3">
                        {cert.badges.map((badge, i) => (
                          <div
                            key={i}
                            className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border-2 border-primary/30 flex items-center justify-center"
                          >
                            <div className="text-center">
                              <span className="text-xs text-primary/70 font-medium">ISO</span>
                              <span className="block text-sm font-bold text-primary">{badge}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : cert.id === 'soc-2-3' ? (
                      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border-2 border-cyan-400/40 flex items-center justify-center">
                        <div className="text-center">
                          <span className="text-xs text-cyan-300 font-medium">AICPA</span>
                          <span className="block text-lg font-bold text-cyan-400">SOC</span>
                        </div>
                      </div>
                    ) : cert.id === 'irap' ? (
                      <div className="flex items-center justify-center">
                        <span className="text-3xl font-bold text-cyan-400 tracking-tight">
                          <span className="text-red-500">•</span>irap
                        </span>
                      </div>
                    ) : (
                      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border-2 border-primary/30 flex items-center justify-center">
                        <div className="text-center">
                          <Globe className="w-8 h-8 text-primary/70 mx-auto" />
                          <span className="block text-sm font-bold text-primary mt-1">{cert.badges[0]}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Title */}
                <h3 className="text-lg font-semibold text-foreground text-center">
                  {cert.title}
                </h3>
                
                {/* Optional description on hover */}
                <p className="text-xs text-muted-foreground text-center mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {cert.description}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
