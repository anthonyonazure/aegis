import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface DiffLine {
  type: 'unchanged' | 'added' | 'removed' | 'modified';
  lineNumber: { left?: number; right?: number };
  content: { left?: string; right?: string };
}

interface DiffViewerProps {
  baseline: Record<string, unknown>;
  current: Record<string, unknown>;
  className?: string;
}

function flattenObject(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key;
    
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value as Record<string, unknown>, newKey));
    } else {
      result[newKey] = JSON.stringify(value);
    }
  }
  
  return result;
}

function computeDiff(baseline: Record<string, unknown>, current: Record<string, unknown>): DiffLine[] {
  const flatBaseline = flattenObject(baseline);
  const flatCurrent = flattenObject(current);
  
  const allKeys = new Set([...Object.keys(flatBaseline), ...Object.keys(flatCurrent)]);
  const sortedKeys = Array.from(allKeys).sort();
  
  const lines: DiffLine[] = [];
  let leftLine = 1;
  let rightLine = 1;
  
  for (const key of sortedKeys) {
    const baselineValue = flatBaseline[key];
    const currentValue = flatCurrent[key];
    
    if (baselineValue === undefined) {
      // Added
      lines.push({
        type: 'added',
        lineNumber: { right: rightLine++ },
        content: { right: `${key}: ${currentValue}` },
      });
    } else if (currentValue === undefined) {
      // Removed
      lines.push({
        type: 'removed',
        lineNumber: { left: leftLine++ },
        content: { left: `${key}: ${baselineValue}` },
      });
    } else if (baselineValue !== currentValue) {
      // Modified
      lines.push({
        type: 'modified',
        lineNumber: { left: leftLine++, right: rightLine++ },
        content: { left: `${key}: ${baselineValue}`, right: `${key}: ${currentValue}` },
      });
    } else {
      // Unchanged
      lines.push({
        type: 'unchanged',
        lineNumber: { left: leftLine++, right: rightLine++ },
        content: { left: `${key}: ${baselineValue}`, right: `${key}: ${currentValue}` },
      });
    }
  }
  
  return lines;
}

export const DiffViewer = ({ baseline, current, className }: DiffViewerProps) => {
  const diffLines = useMemo(() => computeDiff(baseline, current), [baseline, current]);
  
  const stats = useMemo(() => {
    const added = diffLines.filter(l => l.type === 'added').length;
    const removed = diffLines.filter(l => l.type === 'removed').length;
    const modified = diffLines.filter(l => l.type === 'modified').length;
    const unchanged = diffLines.filter(l => l.type === 'unchanged').length;
    return { added, removed, modified, unchanged };
  }, [diffLines]);
  
  return (
    <div className={cn("rounded-lg border border-border overflow-hidden", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b border-border">
        <div className="flex items-center gap-4 text-xs">
          <span className="text-green-400">+{stats.added} added</span>
          <span className="text-red-400">-{stats.removed} removed</span>
          <span className="text-yellow-400">~{stats.modified} modified</span>
          <span className="text-muted-foreground">{stats.unchanged} unchanged</span>
        </div>
      </div>
      
      {/* Diff content */}
      <div className="grid grid-cols-2 divide-x divide-border">
        {/* Left side (baseline) */}
        <div className="bg-muted/20">
          <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground border-b border-border bg-muted/30">
            Baseline
          </div>
          <div className="font-mono text-xs overflow-x-auto">
            {diffLines.map((line, idx) => (
              <motion.div
                key={`left-${idx}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: idx * 0.01 }}
                className={cn(
                  "flex",
                  line.type === 'removed' && "bg-red-500/10",
                  line.type === 'modified' && "bg-yellow-500/10"
                )}
              >
                <span className="w-10 px-2 py-0.5 text-right text-muted-foreground/50 select-none border-r border-border/50 shrink-0">
                  {line.lineNumber.left || ''}
                </span>
                <span className={cn(
                  "px-2 py-0.5 flex-1 whitespace-pre",
                  line.type === 'removed' && "text-red-400",
                  line.type === 'modified' && "text-yellow-400",
                  line.type === 'added' && "invisible"
                )}>
                  {line.type === 'removed' && <span className="mr-1">-</span>}
                  {line.type === 'modified' && <span className="mr-1">-</span>}
                  {line.content.left || ''}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
        
        {/* Right side (current) */}
        <div className="bg-muted/20">
          <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground border-b border-border bg-muted/30">
            Current
          </div>
          <div className="font-mono text-xs overflow-x-auto">
            {diffLines.map((line, idx) => (
              <motion.div
                key={`right-${idx}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: idx * 0.01 }}
                className={cn(
                  "flex",
                  line.type === 'added' && "bg-green-500/10",
                  line.type === 'modified' && "bg-green-500/10"
                )}
              >
                <span className="w-10 px-2 py-0.5 text-right text-muted-foreground/50 select-none border-r border-border/50 shrink-0">
                  {line.lineNumber.right || ''}
                </span>
                <span className={cn(
                  "px-2 py-0.5 flex-1 whitespace-pre",
                  line.type === 'added' && "text-green-400",
                  line.type === 'modified' && "text-green-400",
                  line.type === 'removed' && "invisible"
                )}>
                  {line.type === 'added' && <span className="mr-1">+</span>}
                  {line.type === 'modified' && <span className="mr-1">+</span>}
                  {line.content.right || ''}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
