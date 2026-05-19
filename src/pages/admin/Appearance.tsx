import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Palette, Layout, Type, Save } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { themePresets, templatePresets } from "@/lib/themePresets";
import { toast } from "sonner";

const Appearance = () => {
  const navigate = useNavigate();
  const { activeTheme, activeTemplate, platformName, invoiceName, setTheme, setTemplate, setPlatformName, setInvoiceName } = useTheme();
  const [editPlatformName, setEditPlatformName] = useState(platformName);
  const [editInvoiceName, setEditInvoiceName] = useState(invoiceName);
  const [saving, setSaving] = useState(false);

  const handleSaveNames = async () => {
    setSaving(true);
    try {
      await setPlatformName(editPlatformName);
      await setInvoiceName(editInvoiceName);
      toast.success("تم حفظ الإعدادات بنجاح");
    } catch {
      toast.error("حدث خطأ أثناء الحفظ");
    }
    setSaving(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-accent/20 py-8">
      <div className="container mx-auto px-4 space-y-6">
        <Button onClick={() => navigate("/admin")} variant="ghost">
          <ArrowLeft className="ml-2 h-4 w-4" />
          رجوع
        </Button>

        {/* Platform & Invoice Names */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Type className="h-5 w-5" />
              اسم المنصة والفاتورة
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>اسم المنصة (يظهر في الموقع والنافبار)</Label>
              <Input
                value={editPlatformName}
                onChange={(e) => setEditPlatformName(e.target.value)}
                placeholder="Family Fashion"
                className="mt-1"
              />
            </div>
            <div>
              <Label>اسم الفاتورة (يظهر في الفاتورة والعلامة المائية)</Label>
              <Input
                value={editInvoiceName}
                onChange={(e) => setEditInvoiceName(e.target.value)}
                placeholder="Family Fashion"
                className="mt-1"
              />
            </div>
            <Button onClick={handleSaveNames} disabled={saving}>
              <Save className="ml-2 h-4 w-4" />
              {saving ? "جاري الحفظ..." : "حفظ"}
            </Button>
          </CardContent>
        </Card>

        {/* Theme Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              الثيمات (الألوان)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
              {themePresets.map((theme) => (
                <button
                  key={theme.id}
                  onClick={() => setTheme(theme.id)}
                  className={`p-3 rounded-lg border-2 transition-all text-center ${
                    activeTheme === theme.id
                      ? "border-primary ring-2 ring-primary/30"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div
                    className="w-8 h-8 rounded-full mx-auto mb-2"
                    style={{ backgroundColor: `hsl(${theme.light['--primary']})` }}
                  />
                  <span className="text-xs font-medium">{theme.name}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Template Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layout className="h-5 w-5" />
              قوالب التصميم
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {templatePresets.map((tmpl) => (
                <button
                  key={tmpl.id}
                  onClick={() => setTemplate(tmpl.id)}
                  className={`p-4 rounded-lg border-2 transition-all text-center ${
                    activeTemplate === tmpl.id
                      ? "border-primary ring-2 ring-primary/30 bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <span className="text-sm font-medium block">{tmpl.name}</span>
                  <span className="text-xs text-muted-foreground mt-1 block">{tmpl.description}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Appearance;
