'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { formsAPI } from '@/services/api';
import { 
  ArrowLeft, Plus, Trash2, Copy, ArrowUp, ArrowDown, Eye, Edit3, 
  Settings, Loader2, Save, Sparkles, CheckCircle2, AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

const FIELD_TYPES = [
  { value: 'text', label: 'Short Answer' },
  { value: 'paragraph', label: 'Long Answer (Paragraph)' },
  { value: 'number', label: 'Number Field' },
  { value: 'email', label: 'Email Field' },
  { value: 'phone', label: 'Phone Number' },
  { value: 'date', label: 'Date Picker' },
  { value: 'time', label: 'Time Picker' },
  { value: 'dropdown', label: 'Dropdown Select' },
  { value: 'radio', label: 'Multiple Choice (Radio)' },
  { value: 'checkbox', label: 'Checkboxes' },
  { value: 'yes_no', label: 'Yes / No Question' },
  { value: 'file', label: 'Generic File Upload' },
  { value: 'image', label: 'Image Upload' },
  { value: 'pdf', label: 'PDF Upload' },
  { value: 'ppt', label: 'PPT/PPTX Upload' },
  { value: 'document', label: 'Document Upload (.docx)' },
  { value: 'url', label: 'URL / Website Link' },
];

export default function FormBuilderPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');
  const [formTitle, setFormTitle] = useState('Untitled Registration Form');
  const [formDesc, setFormDesc] = useState('');
  const [isPublish, setIsPublish] = useState(true);
  const [deadline, setDeadline] = useState('');
  const [fields, setFields] = useState<any[]>([
    {
      id: `field_1`,
      type: 'text',
      label: 'Full Name',
      placeholder: 'Enter your legal full name',
      required: true,
      options: [],
      validation: { min_length: 2, max_length: 100 }
    }
  ]);

  // Mutation
  const createMutation = useMutation({
    mutationFn: (data: any) => formsAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forms'] });
      toast.success('Dynamic form successfully published!');
      router.push('/dashboard/forms');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Failed to create form');
    }
  });

  const addField = (type = 'text') => {
    const newField = {
      id: `field_${Date.now()}`,
      type,
      label: 'New Question',
      placeholder: '',
      required: false,
      options: type === 'yes_no' ? ['Yes', 'No'] : ['Option 1', 'Option 2'],
      validation: {}
    };
    setFields([...fields, newField]);
    toast.success('Field added');
  };

  const updateField = (index: number, updates: any) => {
    const updated = [...fields];
    updated[index] = { ...updated[index], ...updates };
    setFields(updated);
  };

  const deleteField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index));
    toast.success('Field deleted');
  };

  const duplicateField = (index: number) => {
    const source = fields[index];
    const clone = {
      ...source,
      id: `field_${Date.now()}`,
      label: `${source.label} (Copy)`
    };
    const updated = [...fields];
    updated.splice(index + 1, 0, clone);
    setFields(updated);
    toast.success('Field duplicated');
  };

  const moveField = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === fields.length - 1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const updated = [...fields];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    setFields(updated);
  };

  // Add Option to choices field
  const addOption = (fieldIndex: number) => {
    const f = fields[fieldIndex];
    const currentOptions = f.options || [];
    updateField(fieldIndex, {
      options: [...currentOptions, `Option ${currentOptions.length + 1}`]
    });
  };

  // Update Option text
  const updateOptionText = (fieldIndex: number, optionIndex: number, text: string) => {
    const f = fields[fieldIndex];
    const updatedOptions = [...f.options];
    updatedOptions[optionIndex] = text;
    updateField(fieldIndex, { options: updatedOptions });
  };

  // Remove Option
  const removeOption = (fieldIndex: number, optionIndex: number) => {
    const f = fields[fieldIndex];
    updateField(fieldIndex, {
      options: f.options.filter((_: any, i: number) => i !== optionIndex)
    });
  };

  const handleSave = () => {
    if (!formTitle.trim()) {
      toast.error('Please specify a form title');
      return;
    }
    if (fields.length === 0) {
      toast.error('Add at least one field/question');
      return;
    }

    const payload = {
      title: formTitle,
      description: formDesc,
      is_active: isPublish,
      deadline: deadline ? new Date(deadline).toISOString() : null,
      fields: fields.map(f => ({
        id: f.id,
        type: f.type,
        label: f.label || 'Question',
        placeholder: f.placeholder || null,
        required: !!f.required,
        options: ['dropdown', 'radio', 'checkbox', 'yes_no'].includes(f.type) ? f.options : null,
        validation: f.validation || null,
        default_value: f.default_value || null,
      }))
    };

    createMutation.mutate(payload);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/dashboard/forms')} className="p-2 rounded-lg bg-white dark:bg-dark-800 border border-dark-200 dark:border-dark-700 hover:bg-dark-50 dark:hover:bg-dark-750">
            <ArrowLeft className="w-4 h-4 text-dark-500" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-dark-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary-500" /> Form Builder
            </h1>
            <p className="text-sm text-dark-500 mt-1">Design and publish custom dynamic fields</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={handleSave} 
            disabled={createMutation.isPending}
            className="btn-primary flex items-center gap-2 px-5 py-2.5"
          >
            {createMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Save className="w-4 h-4" /> Save & Publish
              </>
            )}
          </button>
        </div>
      </div>

      {/* Tabs / Subheader settings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Settings Bar */}
        <div className="lg:col-span-3 bg-white dark:bg-dark-800 rounded-2xl p-5 border border-dark-200 dark:border-dark-700 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setActiveTab('editor')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                activeTab === 'editor'
                  ? 'bg-primary-500 text-white'
                  : 'bg-dark-50 dark:bg-dark-750 text-dark-600 dark:text-dark-300 hover:bg-dark-100'
              }`}
            >
              <Edit3 className="w-4 h-4" /> Editor
            </button>
            <button
              onClick={() => setActiveTab('preview')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                activeTab === 'preview'
                  ? 'bg-primary-500 text-white'
                  : 'bg-dark-50 dark:bg-dark-750 text-dark-600 dark:text-dark-300 hover:bg-dark-100'
              }`}
            >
              <Eye className="w-4 h-4" /> Live Preview
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-sm">
            <label className="flex items-center gap-2 cursor-pointer font-medium text-dark-700 dark:text-dark-300">
              <input 
                type="checkbox" 
                checked={isPublish} 
                onChange={(e) => setIsPublish(e.target.checked)} 
                className="w-4 h-4 rounded text-primary-500" 
              />
              Publish immediately (Active)
            </label>

            <div className="flex items-center gap-2">
              <span className="text-dark-500 font-medium">Closing Date:</span>
              <input
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="bg-dark-50 dark:bg-dark-750 border border-dark-200 dark:border-dark-700 rounded-lg px-2.5 py-1 text-sm text-dark-900 dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* Tab views */}
        {activeTab === 'editor' ? (
          <>
            {/* Editor Workspace */}
            <div className="lg:col-span-2 space-y-6">
              {/* Form Title & Desc Editor */}
              <div className="bg-white dark:bg-dark-800 rounded-2xl p-6 border-t-[6px] border-primary-500 shadow-sm border border-dark-200 dark:border-dark-700 space-y-4">
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Form Title"
                  className="w-full bg-transparent border-b border-transparent hover:border-dark-200 dark:hover:border-dark-700 focus:border-primary-500 py-1 text-2xl font-bold text-dark-900 dark:text-white outline-none transition-colors"
                />
                <textarea
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="Form Description (optional)"
                  rows={2}
                  className="w-full bg-transparent border-b border-transparent hover:border-dark-200 dark:hover:border-dark-700 focus:border-primary-500 py-1 text-sm text-dark-500 dark:text-dark-400 outline-none resize-none transition-colors"
                />
              </div>

              {/* Questions List */}
              <div className="space-y-4">
                {fields.map((field, i) => {
                  const hasChoices = ['dropdown', 'radio', 'checkbox'].includes(field.type);
                  return (
                    <div 
                      key={field.id} 
                      className="bg-white dark:bg-dark-800 rounded-2xl p-6 border border-dark-200 dark:border-dark-700 shadow-sm transition-all relative group"
                    >
                      {/* Field Controls Bar */}
                      <div className="absolute right-4 top-4 opacity-30 group-hover:opacity-100 flex items-center gap-1 bg-white dark:bg-dark-800 border border-dark-100 dark:border-dark-700 rounded-lg p-1 shadow-md transition-opacity">
                        <button onClick={() => moveField(i, 'up')} disabled={i === 0} className="p-1.5 hover:bg-dark-50 dark:hover:bg-dark-750 text-dark-500 rounded disabled:opacity-30">
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => moveField(i, 'down')} disabled={i === fields.length - 1} className="p-1.5 hover:bg-dark-50 dark:hover:bg-dark-750 text-dark-500 rounded disabled:opacity-30">
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <div className="w-[1px] h-4 bg-dark-200 dark:bg-dark-700 mx-1" />
                        <button onClick={() => duplicateField(i)} className="p-1.5 hover:bg-dark-50 dark:hover:bg-dark-750 text-dark-500 hover:text-primary-500 rounded">
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => deleteField(i)} className="p-1.5 hover:bg-dark-50 dark:hover:bg-dark-750 text-dark-500 hover:text-red-500 rounded">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Main editor */}
                      <div className="space-y-4">
                        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center pr-24">
                          <input
                            type="text"
                            value={field.label}
                            onChange={(e) => updateField(i, { label: e.target.value })}
                            placeholder="Enter your question here..."
                            className="bg-transparent border-b border-dark-200 dark:border-dark-700 hover:border-dark-300 focus:border-primary-500 font-semibold text-dark-900 dark:text-white py-1 flex-1 outline-none text-base"
                          />
                          <select
                            value={field.type}
                            onChange={(e) => updateField(i, { type: e.target.value })}
                            className="input-field max-w-[200px] text-sm py-1.5 px-3 bg-dark-50 dark:bg-dark-750 border-dark-200"
                          >
                            {FIELD_TYPES.map(t => (
                              <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                          </select>
                        </div>

                        {/* Placeholder input */}
                        {!hasChoices && field.type !== 'yes_no' && (
                          <input
                            type="text"
                            value={field.placeholder || ''}
                            onChange={(e) => updateField(i, { placeholder: e.target.value })}
                            placeholder="Help text/placeholder (optional)"
                            className="input-field text-sm py-1.5 border-dashed"
                          />
                        )}

                        {/* Choices configuration */}
                        {hasChoices && (
                          <div className="space-y-2.5 bg-dark-50 dark:bg-dark-850 p-4 rounded-xl border border-dark-150 dark:border-dark-750">
                            <span className="text-xs font-semibold text-dark-500 block">Configure Options:</span>
                            <div className="space-y-2">
                              {(field.options || []).map((opt: string, optIdx: number) => (
                                <div key={optIdx} className="flex items-center gap-2">
                                  <div className="w-1.5 h-1.5 rounded-full bg-dark-400" />
                                  <input
                                    type="text"
                                    value={opt}
                                    onChange={(e) => updateOptionText(i, optIdx, e.target.value)}
                                    className="bg-white dark:bg-dark-800 border border-dark-200 dark:border-dark-700 rounded-lg px-2.5 py-1 text-sm text-dark-900 dark:text-white flex-1"
                                  />
                                  <button onClick={() => removeOption(i, optIdx)} className="p-1 hover:bg-dark-200 dark:hover:bg-dark-700 text-red-500 rounded">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ))}
                            </div>
                            <button 
                              onClick={() => addOption(i)}
                              className="btn-secondary text-xs flex items-center gap-1 py-1 px-2.5 mt-2 bg-white dark:bg-dark-800"
                            >
                              <Plus className="w-3.5 h-3.5" /> Add Option
                            </button>
                          </div>
                        )}

                        {/* Yes/No display indicator */}
                        {field.type === 'yes_no' && (
                          <div className="flex gap-4 text-sm text-dark-500 italic p-3 bg-dark-50 dark:bg-dark-850 rounded-lg">
                            <span>O Yes</span>
                            <span>O No</span>
                          </div>
                        )}

                        {/* Footer field settings */}
                        <div className="flex items-center justify-between border-t border-dark-100 dark:border-dark-700 pt-3 text-xs text-dark-400 mt-4">
                          <label className="flex items-center gap-1.5 font-medium cursor-pointer text-dark-600 dark:text-dark-350">
                            <input 
                              type="checkbox" 
                              checked={field.required} 
                              onChange={(e) => updateField(i, { required: e.target.checked })} 
                              className="rounded text-primary-500" 
                            />
                            Required Field
                          </label>
                          <span className="font-mono text-[10px]">Type: {field.type}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Add Field Button */}
              <button 
                onClick={() => addField('text')}
                className="btn-secondary w-full p-4 border-dashed border-2 hover:border-primary-500 hover:text-primary-500 bg-white dark:bg-dark-800 rounded-2xl flex items-center justify-center gap-2 text-sm font-semibold transition-colors"
              >
                <Plus className="w-4 h-4" /> Add Question Field
              </button>
            </div>

            {/* Quick Toolbox Side Panel */}
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-white dark:bg-dark-800 rounded-2xl p-6 border border-dark-200 dark:border-dark-700 shadow-sm space-y-4">
                <h3 className="font-bold text-dark-900 dark:text-white flex items-center gap-2 text-sm uppercase tracking-wider">
                  <Plus className="w-4 h-4 text-primary-500" /> Quick Templates
                </h3>
                <p className="text-xs text-dark-500">Add common university field types instantly:</p>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => addField('text')} className="btn-secondary text-xs text-left p-2.5">Text Field</button>
                  <button onClick={() => addField('paragraph')} className="btn-secondary text-xs text-left p-2.5">Paragraph</button>
                  <button onClick={() => addField('yes_no')} className="btn-secondary text-xs text-left p-2.5">Yes / No</button>
                  <button onClick={() => addField('dropdown')} className="btn-secondary text-xs text-left p-2.5">Dropdown</button>
                  <button onClick={() => addField('file')} className="btn-secondary text-xs text-left p-2.5">File Upload</button>
                  <button onClick={() => addField('image')} className="btn-secondary text-xs text-left p-2.5">Image Upload</button>
                  <button onClick={() => addField('pdf')} className="btn-secondary text-xs text-left p-2.5">PDF Upload</button>
                  <button onClick={() => addField('url')} className="btn-secondary text-xs text-left p-2.5">URL Field</button>
                </div>
              </div>
            </div>
          </>
        ) : (
          /* Live Interactive Preview Panel */
          <div className="lg:col-span-3 bg-white dark:bg-dark-800 rounded-2xl p-6 border border-dark-200 dark:border-dark-700 shadow-sm space-y-6 max-w-2xl mx-auto border-t-[6px] border-primary-500">
            <div>
              <h2 className="text-2xl font-bold text-dark-900 dark:text-white">{formTitle}</h2>
              {formDesc && <p className="text-sm text-dark-500 mt-2 whitespace-pre-wrap">{formDesc}</p>}
            </div>

            <div className="space-y-6 pt-4 border-t border-dark-100 dark:border-dark-700">
              {fields.map((field, idx) => (
                <div key={field.id} className="space-y-2">
                  <label className="block text-sm font-semibold text-dark-850 dark:text-dark-200">
                    {field.label || 'Question'} {field.required && <span className="text-red-500">*</span>}
                  </label>
                  
                  {field.type === 'paragraph' && (
                    <textarea placeholder={field.placeholder} className="input-field" rows={3} disabled />
                  )}

                  {field.type === 'dropdown' && (
                    <select className="input-field" disabled>
                      <option>Select Option...</option>
                      {(field.options || []).map((o: string) => (
                        <option key={o}>{o}</option>
                      ))}
                    </select>
                  )}

                  {field.type === 'radio' && (
                    <div className="space-y-1.5">
                      {(field.options || []).map((o: string) => (
                        <label key={o} className="flex items-center gap-2 text-sm text-dark-600 dark:text-dark-300">
                          <input type="radio" name={field.id} disabled /> {o}
                        </label>
                      ))}
                    </div>
                  )}

                  {field.type === 'checkbox' && (
                    <div className="space-y-1.5">
                      {(field.options || []).map((o: string) => (
                        <label key={o} className="flex items-center gap-2 text-sm text-dark-600 dark:text-dark-300">
                          <input type="checkbox" disabled /> {o}
                        </label>
                      ))}
                    </div>
                  )}

                  {field.type === 'yes_no' && (
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 text-sm text-dark-600 dark:text-dark-300">
                        <input type="radio" name={field.id} disabled /> Yes
                      </label>
                      <label className="flex items-center gap-2 text-sm text-dark-600 dark:text-dark-300">
                        <input type="radio" name={field.id} disabled /> No
                      </label>
                    </div>
                  )}

                  {['file', 'image', 'pdf', 'ppt', 'document'].includes(field.type) && (
                    <div className="border border-dashed border-dark-300 dark:border-dark-600 rounded-xl p-6 text-center text-xs text-dark-400 bg-dark-50 dark:bg-dark-850">
                      Upload limit 10MB. Accepted file type: {field.type.toUpperCase()}
                    </div>
                  )}

                  {!['paragraph', 'dropdown', 'radio', 'checkbox', 'yes_no', 'file', 'image', 'pdf', 'ppt', 'document'].includes(field.type) && (
                    <input 
                      type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : field.type === 'time' ? 'time' : 'text'} 
                      placeholder={field.placeholder} 
                      className="input-field" 
                      disabled 
                    />
                  )}
                </div>
              ))}

              {fields.length === 0 && (
                <p className="text-center text-sm text-dark-400 py-8 italic">Add questions to see interactive preview</p>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-8 border-t border-dark-100 dark:border-dark-700 pt-4">
              <button className="btn-secondary" disabled>Clear Form</button>
              <button className="btn-primary" disabled>Submit Form</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
