import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Navbar from '@/components/Navbar';
import { useAuthStore } from '@/stores/authStore';
import { useAssessmentStore } from '@/stores/assessmentStore';
import { Upload, FileIcon, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import JSZip from 'jszip';

const FileUpload = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { setUploadedFiles, uploadedFiles } = useAssessmentStore();
  const [projectName, setProjectName] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
    }
  }, [user, navigate]);

  const handleFileUpload = async (file: File) => {
    if (!file.name.endsWith('.zip')) {
      toast.error('Please upload a ZIP file');
      return;
    }

    try {
      const zip = new JSZip();
      const contents = await zip.loadAsync(file);
      const files: any[] = [];

      for (const [path, zipEntry] of Object.entries(contents.files)) {
        if (!zipEntry.dir && !path.includes('node_modules') && !path.includes('.git')) {
          const content = await zipEntry.async('text');
          files.push({
            name: path,
            path: path,
            size: content.length,
            content: content.substring(0, 500), // Preview
          });
        }
      }

      setUploadedFiles(files);
      toast.success(`Extracted ${files.length} files`);
    } catch (error) {
      toast.error('Failed to extract ZIP file');
    }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileUpload(file);
    }
  }, []);

  const handleStartAssessment = () => {
    if (!projectName.trim()) {
      toast.error('Please enter a project name');
      return;
    }
    if (uploadedFiles.length === 0) {
      toast.error('Please upload project files');
      return;
    }
    navigate('/permissions');
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 pt-24 pb-12 max-w-4xl">
        <div className="mb-8 animate-fade-in">
          <h1 className="text-4xl font-bold mb-2">Upload Project</h1>
          <p className="text-muted-foreground">
            Upload your project files to begin the assessment
          </p>
        </div>

        <div className="space-y-6">
          <Card className="p-6 gradient-card">
            <div className="space-y-2 mb-4">
              <Label htmlFor="projectName">Project Name</Label>
              <Input
                id="projectName"
                placeholder="My Awesome Project"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
              />
            </div>
          </Card>

          <Card
            className={`p-12 border-2 border-dashed transition-colors ${
              isDragging ? 'border-primary bg-primary/5' : 'border-border'
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
          >
            <div className="text-center">
              <Upload className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">
                Drop your ZIP file here
              </h3>
              <p className="text-muted-foreground mb-4">
                or click to browse
              </p>
              <Input
                type="file"
                accept=".zip"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                }}
                className="hidden"
                id="file-upload"
              />
              <Button variant="outline" onClick={() => document.getElementById('file-upload')?.click()}>
                Browse Files
              </Button>
            </div>
          </Card>

          {uploadedFiles.length > 0 && (
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">
                  Uploaded Files ({uploadedFiles.length})
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setUploadedFiles([])}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {uploadedFiles.slice(0, 10).map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg"
                  >
                    <FileIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm flex-1 truncate">{file.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {(file.size / 1024).toFixed(2)} KB
                    </span>
                  </div>
                ))}
                {uploadedFiles.length > 10 && (
                  <p className="text-sm text-muted-foreground text-center">
                    and {uploadedFiles.length - 10} more files...
                  </p>
                )}
              </div>
            </Card>
          )}

          <Button
            size="lg"
            onClick={handleStartAssessment}
            disabled={!projectName || uploadedFiles.length === 0}
            className="w-full gradient-primary text-white"
          >
            Start Assessment
          </Button>
        </div>
      </main>
    </div>
  );
};

export default FileUpload;
