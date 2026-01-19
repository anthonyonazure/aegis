import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  UserCheck, 
  Loader2, 
  AlertTriangle, 
  Shield, 
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  Eye,
  Lock,
  Users,
  Clock,
  FileWarning,
  CheckCircle,
  XCircle,
  BarChart3,
  Target,
  History
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface RiskCategory {
  category: string;
  score: number;
  level: string;
  factors: string[];
  weight: number;
}

interface RiskIndicator {
  indicator: string;
  severity: string;
  description: string;
  firstDetected: string;
  frequency: string;
  evidence: string[];
}

interface Recommendation {
  priority: string;
  action: string;
  rationale: string;
  expectedImpact: string;
  implementation: string;
}

interface HistoricalTrend {
  period: string;
  score: number;
  keyEvents: string[];
}

interface RiskAnalysis {
  userProfile: {
    displayName: string;
    email: string;
    department: string;
    jobTitle: string;
    accountAge: string;
    lastActive: string;
  };
  overallRiskScore: number;
  riskLevel: string;
  riskTrend: string;
  confidenceScore: number;
  riskCategories: RiskCategory[];
  behaviorAnalysis: {
    signInPatterns: {
      normalHours: string;
      unusualActivity: string[];
      locationConsistency: string;
      deviceTrust: string;
    };
    dataAccess: {
      sensitiveDataAccess: string;
      downloadPatterns: string;
      sharingBehavior: string;
      externalCollaboration: string;
    };
    privilegeUsage: {
      adminActions: string;
      privilegeEscalation: string;
      delegatedAccess: string;
    };
  };
  riskIndicators: RiskIndicator[];
  comparisonToPeers: {
    riskPercentile: number;
    departmentAverage: number;
    organizationAverage: number;
    peerGroupSize: number;
    standoutFactors: string[];
  };
  recommendations: Recommendation[];
  monitoringPlan: {
    focusAreas: string[];
    alertThresholds: Array<{
      metric: string;
      threshold: string;
      action: string;
    }>;
    reviewFrequency: string;
  };
  historicalTrend: HistoricalTrend[];
  accessReview: {
    unnecessaryAccess: string[];
    excessivePermissions: string[];
    recommendedRemovals: string[];
    justificationNeeded: string[];
  };
}

export const UserRiskProfiler: React.FC = () => {
  const [analysis, setAnalysis] = useState<RiskAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [userEmail, setUserEmail] = useState('');

  const getRiskColor = (level: string) => {
    switch (level?.toLowerCase()) {
      case 'critical': return 'text-red-600 bg-red-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-green-600 bg-green-100';
      default: return 'text-muted-foreground bg-muted';
    }
  };

  const getRiskScoreColor = (score: number) => {
    if (score >= 75) return 'text-red-600';
    if (score >= 50) return 'text-orange-600';
    if (score >= 25) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getTrendIcon = (trend: string) => {
    switch (trend?.toLowerCase()) {
      case 'improving': return <TrendingDown className="h-4 w-4 text-green-600" />;
      case 'worsening': return <TrendingUp className="h-4 w-4 text-red-600" />;
      default: return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'immediate': return 'text-red-600 bg-red-100';
      case 'short-term': return 'text-orange-600 bg-orange-100';
      case 'long-term': return 'text-blue-600 bg-blue-100';
      default: return 'text-muted-foreground bg-muted';
    }
  };

  const analyzeUser = async () => {
    if (!userEmail.trim()) {
      toast.error('Please enter a user email');
      return;
    }

    setLoading(true);
    try {
      // Mock user data for demo
      const userData = {
        email: userEmail,
        displayName: userEmail.split('@')[0].replace('.', ' ').replace(/\b\w/g, l => l.toUpperCase()),
        department: 'Engineering',
        jobTitle: 'Senior Developer',
        signInCount: 45,
        failedSignIns: 3,
        riskySignIns: 1,
        lastSignIn: new Date().toISOString(),
        deviceCount: 3,
        locationCount: 2,
        adminRoles: ['Application Administrator'],
        sensitiveDataAccess: true,
        externalSharing: 12,
        downloadCount: 156
      };

      const tenantContext = {
        totalUsers: 500,
        securityDefaults: true,
        conditionalAccess: true,
        mfaEnforced: true
      };

      const { data, error } = await supabase.functions.invoke('ai-user-risk-profiler', {
        body: { userData, tenantContext }
      });

      if (error) throw error;
      setAnalysis(data);
      toast.success('User risk profile generated');
    } catch (error) {
      console.error('Error analyzing user:', error);
      toast.error('Failed to analyze user risk');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Input Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            User Risk Profiler
          </CardTitle>
          <CardDescription>
            Analyze individual user behavior and generate comprehensive risk profiles
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="userEmail">User Email</Label>
              <Input
                id="userEmail"
                placeholder="user@contoso.com"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="flex items-end">
              <Button onClick={analyzeUser} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Shield className="mr-2 h-4 w-4" />
                    Analyze Risk Profile
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Analysis Results */}
      {analysis && (
        <>
          {/* User Profile & Score Summary */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-primary/10">
                    <UserCheck className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">User</p>
                    <p className="font-semibold">{analysis.userProfile.displayName}</p>
                    <p className="text-xs text-muted-foreground">{analysis.userProfile.department}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Risk Score</p>
                    <p className={`text-3xl font-bold ${getRiskScoreColor(analysis.overallRiskScore)}`}>
                      {analysis.overallRiskScore}
                    </p>
                  </div>
                  <Badge className={getRiskColor(analysis.riskLevel)}>
                    {analysis.riskLevel}
                  </Badge>
                </div>
                <Progress value={analysis.overallRiskScore} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  {getTrendIcon(analysis.riskTrend)}
                  <div>
                    <p className="text-sm text-muted-foreground">Risk Trend</p>
                    <p className="font-semibold capitalize">{analysis.riskTrend}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Confidence: {analysis.confidenceScore}%
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <BarChart3 className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="text-sm text-muted-foreground">Peer Comparison</p>
                    <p className="font-semibold">
                      {analysis.comparisonToPeers.riskPercentile}th percentile
                    </p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Org avg: {analysis.comparisonToPeers.organizationAverage}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Analysis Tabs */}
          <Card>
            <CardContent className="pt-6">
              <Tabs defaultValue="categories">
                <TabsList className="grid w-full grid-cols-6">
                  <TabsTrigger value="categories">Risk Categories</TabsTrigger>
                  <TabsTrigger value="behavior">Behavior</TabsTrigger>
                  <TabsTrigger value="indicators">Indicators</TabsTrigger>
                  <TabsTrigger value="access">Access Review</TabsTrigger>
                  <TabsTrigger value="recommendations">Actions</TabsTrigger>
                  <TabsTrigger value="history">History</TabsTrigger>
                </TabsList>

                <TabsContent value="categories" className="mt-4">
                  <ScrollArea className="h-[400px]">
                    <div className="grid gap-4 md:grid-cols-2">
                      {analysis.riskCategories.map((category, index) => (
                        <Card key={index}>
                          <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-sm">{category.category}</CardTitle>
                              <Badge className={getRiskColor(category.level)}>
                                {category.score}
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <Progress value={category.score} className="mb-3" />
                            <div className="space-y-1">
                              {category.factors.map((factor, i) => (
                                <p key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                                  <AlertTriangle className="h-3 w-3 mt-1 flex-shrink-0" />
                                  {factor}
                                </p>
                              ))}
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">
                              Weight: {(category.weight * 100).toFixed(0)}%
                            </p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="behavior" className="mt-4">
                  <ScrollArea className="h-[400px]">
                    <div className="grid gap-4 md:grid-cols-3">
                      {/* Sign-in Patterns */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            Sign-in Patterns
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div>
                            <p className="text-xs text-muted-foreground">Normal Hours</p>
                            <p className="text-sm">{analysis.behaviorAnalysis.signInPatterns.normalHours}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Location Consistency</p>
                            <p className="text-sm">{analysis.behaviorAnalysis.signInPatterns.locationConsistency}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Device Trust</p>
                            <p className="text-sm">{analysis.behaviorAnalysis.signInPatterns.deviceTrust}</p>
                          </div>
                          {analysis.behaviorAnalysis.signInPatterns.unusualActivity.length > 0 && (
                            <div>
                              <p className="text-xs text-muted-foreground">Unusual Activity</p>
                              {analysis.behaviorAnalysis.signInPatterns.unusualActivity.map((activity, i) => (
                                <Badge key={i} variant="outline" className="mr-1 mt-1">
                                  {activity}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      {/* Data Access */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Eye className="h-4 w-4" />
                            Data Access
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div>
                            <p className="text-xs text-muted-foreground">Sensitive Data Access</p>
                            <p className="text-sm">{analysis.behaviorAnalysis.dataAccess.sensitiveDataAccess}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Download Patterns</p>
                            <p className="text-sm">{analysis.behaviorAnalysis.dataAccess.downloadPatterns}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Sharing Behavior</p>
                            <p className="text-sm">{analysis.behaviorAnalysis.dataAccess.sharingBehavior}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">External Collaboration</p>
                            <p className="text-sm">{analysis.behaviorAnalysis.dataAccess.externalCollaboration}</p>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Privilege Usage */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Lock className="h-4 w-4" />
                            Privilege Usage
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div>
                            <p className="text-xs text-muted-foreground">Admin Actions</p>
                            <p className="text-sm">{analysis.behaviorAnalysis.privilegeUsage.adminActions}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Privilege Escalation</p>
                            <p className="text-sm">{analysis.behaviorAnalysis.privilegeUsage.privilegeEscalation}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Delegated Access</p>
                            <p className="text-sm">{analysis.behaviorAnalysis.privilegeUsage.delegatedAccess}</p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="indicators" className="mt-4">
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-3">
                      {analysis.riskIndicators.map((indicator, index) => (
                        <Alert key={index} className={indicator.severity === 'critical' || indicator.severity === 'high' ? 'border-red-200' : ''}>
                          <FileWarning className="h-4 w-4" />
                          <AlertTitle className="flex items-center justify-between">
                            <span>{indicator.indicator}</span>
                            <Badge className={getRiskColor(indicator.severity)}>
                              {indicator.severity}
                            </Badge>
                          </AlertTitle>
                          <AlertDescription>
                            <p className="mt-1">{indicator.description}</p>
                            <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                              <span>First detected: {indicator.firstDetected}</span>
                              <span>Frequency: {indicator.frequency}</span>
                            </div>
                            {indicator.evidence.length > 0 && (
                              <div className="mt-2">
                                <p className="text-xs font-medium">Evidence:</p>
                                <ul className="list-disc list-inside text-xs mt-1">
                                  {indicator.evidence.map((e, i) => (
                                    <li key={i}>{e}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </AlertDescription>
                        </Alert>
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="access" className="mt-4">
                  <ScrollArea className="h-[400px]">
                    <div className="grid gap-4 md:grid-cols-2">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm flex items-center gap-2">
                            <XCircle className="h-4 w-4 text-red-600" />
                            Excessive Permissions
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          {analysis.accessReview.excessivePermissions.length > 0 ? (
                            <ul className="space-y-2">
                              {analysis.accessReview.excessivePermissions.map((perm, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm">
                                  <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                                  {perm}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-sm text-muted-foreground">No excessive permissions found</p>
                          )}
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Target className="h-4 w-4 text-orange-600" />
                            Unnecessary Access
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          {analysis.accessReview.unnecessaryAccess.length > 0 ? (
                            <ul className="space-y-2">
                              {analysis.accessReview.unnecessaryAccess.map((access, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm">
                                  <XCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                                  {access}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-sm text-muted-foreground">No unnecessary access found</p>
                          )}
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            Recommended Removals
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          {analysis.accessReview.recommendedRemovals.length > 0 ? (
                            <ul className="space-y-2">
                              {analysis.accessReview.recommendedRemovals.map((removal, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm">
                                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                                  {removal}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-sm text-muted-foreground">No removals recommended</p>
                          )}
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Users className="h-4 w-4 text-blue-600" />
                            Justification Needed
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          {analysis.accessReview.justificationNeeded.length > 0 ? (
                            <ul className="space-y-2">
                              {analysis.accessReview.justificationNeeded.map((item, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm">
                                  <Activity className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                                  {item}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-sm text-muted-foreground">No justification needed</p>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="recommendations" className="mt-4">
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-3">
                      {analysis.recommendations.map((rec, index) => (
                        <Card key={index}>
                          <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-sm">{rec.action}</CardTitle>
                              <Badge className={getPriorityColor(rec.priority)}>
                                {rec.priority}
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-2">
                            <div>
                              <p className="text-xs font-medium text-muted-foreground">Rationale</p>
                              <p className="text-sm">{rec.rationale}</p>
                            </div>
                            <div>
                              <p className="text-xs font-medium text-muted-foreground">Expected Impact</p>
                              <p className="text-sm">{rec.expectedImpact}</p>
                            </div>
                            <div>
                              <p className="text-xs font-medium text-muted-foreground">Implementation</p>
                              <p className="text-sm">{rec.implementation}</p>
                            </div>
                          </CardContent>
                        </Card>
                      ))}

                      {/* Monitoring Plan */}
                      <Card className="mt-4">
                        <CardHeader>
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Activity className="h-4 w-4" />
                            Monitoring Plan
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div>
                            <p className="text-xs font-medium text-muted-foreground">Focus Areas</p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {analysis.monitoringPlan.focusAreas.map((area, i) => (
                                <Badge key={i} variant="outline">{area}</Badge>
                              ))}
                            </div>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-muted-foreground">Review Frequency</p>
                            <p className="text-sm">{analysis.monitoringPlan.reviewFrequency}</p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-muted-foreground">Alert Thresholds</p>
                            <div className="space-y-2 mt-1">
                              {analysis.monitoringPlan.alertThresholds.map((threshold, i) => (
                                <div key={i} className="text-sm p-2 bg-muted rounded">
                                  <span className="font-medium">{threshold.metric}:</span> {threshold.threshold} → {threshold.action}
                                </div>
                              ))}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="history" className="mt-4">
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-4">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm flex items-center gap-2">
                            <History className="h-4 w-4" />
                            Risk Score Trend
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            {analysis.historicalTrend.map((period, index) => (
                              <div key={index} className="flex items-center gap-4 p-3 border rounded">
                                <div className="w-24 text-sm font-medium">{period.period}</div>
                                <div className="flex-1">
                                  <Progress value={period.score} className="h-2" />
                                </div>
                                <Badge className={getRiskColor(
                                  period.score >= 75 ? 'critical' :
                                  period.score >= 50 ? 'high' :
                                  period.score >= 25 ? 'medium' : 'low'
                                )}>
                                  {period.score}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">Key Events Timeline</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            {analysis.historicalTrend.map((period, index) => (
                              period.keyEvents.length > 0 && (
                                <div key={index}>
                                  <p className="text-sm font-medium">{period.period}</p>
                                  <ul className="list-disc list-inside text-sm text-muted-foreground mt-1">
                                    {period.keyEvents.map((event, i) => (
                                      <li key={i}>{event}</li>
                                    ))}
                                  </ul>
                                </div>
                              )
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};
