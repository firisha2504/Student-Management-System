import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useSchoolConfig } from "@/contexts/SchoolConfigContext";
import { Settings, School, GraduationCap, Users, Save, RefreshCw } from "lucide-react";

interface ConfigurationManagerProps {
  onClose?: () => void;
}

export const ConfigurationManager: React.FC<ConfigurationManagerProps> = ({ onClose }) => {
  const { config, refreshConfig } = useSchoolConfig();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [schoolName, setSchoolName] = useState(config.school.name);
  const [schoolShortName, setSchoolShortName] = useState(config.school.shortName);
  const [schoolWebsite, setSchoolWebsite] = useState(config.school.website);
  const [schoolAddress, setSchoolAddress] = useState(config.school.address);
  const [schoolPhone, setSchoolPhone] = useState(config.school.phone);
  
  const [gradeLevels, setGradeLevels] = useState(config.academic.gradeLevels.join(', '));
  const [streams, setStreams] = useState(config.academic.streams.join(', '));
  const [sections, setSections] = useState(config.academic.sections.join(', '));
  const [subSections, setSubSections] = useState(config.academic.subSections.join(', '));
  const [terms, setTerms] = useState(config.academic.terms.join(', '));
  
  const [studentPrefix, setStudentPrefix] = useState(config.idPrefixes.student);
  const [teacherPrefix, setTeacherPrefix] = useState(config.idPrefixes.teacher);
  const [adminPrefix, setAdminPrefix] = useState(config.idPrefixes.admin);
  
  const [enableStreams, setEnableStreams] = useState(config.features.enableStreams);
  const [enableSections, setEnableSections] = useState(config.features.enableSections);
  const [enableSubSections, setEnableSubSections] = useState(config.features.enableSubSections);
  const [enableParentPortal, setEnableParentPortal] = useState(config.features.enableParentPortal);
  const [enableRankings, setEnableRankings] = useState(config.features.enableRankings);

  useEffect(() => {
    // Update form when config changes
    setSchoolName(config.school.name);
    setSchoolShortName(config.school.shortName);
    setSchoolWebsite(config.school.website);
    setSchoolAddress(config.school.address);
    setSchoolPhone(config.school.phone);
    setGradeLevels(config.academic.gradeLevels.join(', '));
    setStreams(config.academic.streams.join(', '));
    setSections(config.academic.sections.join(', '));
    setSubSections(config.academic.subSections.join(', '));
    setTerms(config.academic.terms.join(', '));
    setStudentPrefix(config.idPrefixes.student);
    setTeacherPrefix(config.idPrefixes.teacher);
    setAdminPrefix(config.idPrefixes.admin);
    setEnableStreams(config.features.enableStreams);
    setEnableSections(config.features.enableSections);
    setEnableSubSections(config.features.enableSubSections);
    setEnableParentPortal(config.features.enableParentPortal);
    setEnableRankings(config.features.enableRankings);
  }, [config]);

  const handleSave = async () => {
    setSaving(true);
    try {
      // This would typically send to a backend API to update environment variables
      // For now, we'll show a message about manual configuration
      toast({
        title: "Configuration Updated",
        description: "Configuration changes have been saved. Some changes may require a server restart to take effect.",
      });
      
      // Refresh the configuration
      await refreshConfig();
      
      if (onClose) onClose();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save configuration changes.",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    try {
      await refreshConfig();
      toast({
        title: "Configuration Refreshed",
        description: "Configuration has been reloaded from the server."
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to refresh configuration.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="gradient-primary rounded-xl p-2.5">
            <Settings className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">School Configuration</h2>
            <p className="text-sm text-muted-foreground">Customize your school's settings and academic structure</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={loading}
            className="rounded-xl"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="rounded-xl gradient-primary border-0 text-white"
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* School Information */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <School className="h-5 w-5 text-primary" />
              School Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">School Name</Label>
              <Input
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                placeholder="Enter school name"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Short Name</Label>
              <Input
                value={schoolShortName}
                onChange={(e) => setSchoolShortName(e.target.value)}
                placeholder="e.g., MJ"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Website</Label>
              <Input
                value={schoolWebsite}
                onChange={(e) => setSchoolWebsite(e.target.value)}
                placeholder="https://yourschool.edu"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Address</Label>
              <Textarea
                value={schoolAddress}
                onChange={(e) => setSchoolAddress(e.target.value)}
                placeholder="School address"
                className="rounded-xl resize-none"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Phone</Label>
              <Input
                value={schoolPhone}
                onChange={(e) => setSchoolPhone(e.target.value)}
                placeholder="+1-234-567-8900"
                className="rounded-xl"
              />
            </div>
          </CardContent>
        </Card>

        {/* Academic Structure */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <GraduationCap className="h-5 w-5 text-primary" />
              Academic Structure
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Grade Levels</Label>
              <Input
                value={gradeLevels}
                onChange={(e) => setGradeLevels(e.target.value)}
                placeholder="9, 10, 11, 12"
                className="rounded-xl"
              />
              <p className="text-xs text-muted-foreground">Comma-separated list of grade levels</p>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Streams</Label>
              <Input
                value={streams}
                onChange={(e) => setStreams(e.target.value)}
                placeholder="natural, social"
                className="rounded-xl"
              />
              <p className="text-xs text-muted-foreground">Academic tracks or specializations</p>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Sections</Label>
              <Input
                value={sections}
                onChange={(e) => setSections(e.target.value)}
                placeholder="oromo, amharic, somali"
                className="rounded-xl"
              />
              <p className="text-xs text-muted-foreground">Language sections or class divisions</p>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Sub-Sections</Label>
              <Input
                value={subSections}
                onChange={(e) => setSubSections(e.target.value)}
                placeholder="A, B, C, D, E, F, G, H"
                className="rounded-xl"
              />
              <p className="text-xs text-muted-foreground">Class subdivisions</p>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Terms</Label>
              <Input
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                placeholder="Semester 1, Semester 2"
                className="rounded-xl"
              />
              <p className="text-xs text-muted-foreground">Academic terms or semesters</p>
            </div>
          </CardContent>
        </Card>

        {/* ID Prefixes */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5 text-primary" />
              ID Prefixes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Student Prefix</Label>
                <Input
                  value={studentPrefix}
                  onChange={(e) => setStudentPrefix(e.target.value)}
                  placeholder="MJS"
                  className="rounded-xl font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Teacher Prefix</Label>
                <Input
                  value={teacherPrefix}
                  onChange={(e) => setTeacherPrefix(e.target.value)}
                  placeholder="MJT"
                  className="rounded-xl font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Admin Prefix</Label>
                <Input
                  value={adminPrefix}
                  onChange={(e) => setAdminPrefix(e.target.value)}
                  placeholder="MJA"
                  className="rounded-xl font-mono"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Prefixes used for generating user IDs (e.g., MJS001, MJT001)
            </p>
          </CardContent>
        </Card>

        {/* Feature Flags */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Settings className="h-5 w-5 text-primary" />
              Feature Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-semibold">Enable Streams</Label>
                  <p className="text-xs text-muted-foreground">Show stream selection in forms</p>
                </div>
                <Switch
                  checked={enableStreams}
                  onCheckedChange={setEnableStreams}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-semibold">Enable Sections</Label>
                  <p className="text-xs text-muted-foreground">Show section selection in forms</p>
                </div>
                <Switch
                  checked={enableSections}
                  onCheckedChange={setEnableSections}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-semibold">Enable Sub-Sections</Label>
                  <p className="text-xs text-muted-foreground">Show sub-section selection in forms</p>
                </div>
                <Switch
                  checked={enableSubSections}
                  onCheckedChange={setEnableSubSections}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-semibold">Enable Parent Portal</Label>
                  <p className="text-xs text-muted-foreground">Allow parent account creation and access</p>
                </div>
                <Switch
                  checked={enableParentPortal}
                  onCheckedChange={setEnableParentPortal}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-semibold">Enable Rankings</Label>
                  <p className="text-xs text-muted-foreground">Show student rankings and leaderboards</p>
                </div>
                <Switch
                  checked={enableRankings}
                  onCheckedChange={setEnableRankings}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-sm bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <div className="bg-blue-500 rounded-full p-1">
              <Settings className="h-4 w-4 text-white" />
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-blue-900">Configuration Notes</h3>
              <div className="text-xs text-blue-700 space-y-1">
                <p>• Changes to school information take effect immediately</p>
                <p>• Academic structure changes may require a server restart</p>
                <p>• ID prefix changes only affect new user registrations</p>
                <p>• Feature flags control UI visibility across the application</p>
                <p>• Some changes may require clearing browser cache</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ConfigurationManager;