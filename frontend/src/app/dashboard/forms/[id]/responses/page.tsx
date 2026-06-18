'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { formsAPI } from '@/services/api';
import { ArrowLeft, Download, FileSpreadsheet, FileText, Loader2, User, Calendar, Check, X, ChevronLeft, ChevronRight, BarChart2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function FormResponsesPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const formId = parseInt(params.id as string);
  const [activeTab, setActiveTab] = useState<'summary' | 'individual'>('summary');
  const [individualIndex, setIndividualIndex] = useState(0);
  const [adminRemarks, setAdminRemarks] = useState('');

  // Fetch Form
  const { data: formData, isLoading: isLoadingForm } = useQuery({
    queryKey: ['form', formId],
    queryFn: () => formsAPI.get(formId),
    enabled: !!formId,
  });

  // Fetch Responses
  const { data: responsesData, isLoading: isLoadingResponses } = useQuery({
    queryKey: ['form-responses', formId],
    queryFn: () => formsAPI.responses(formId, { size: 100 }),
    enabled: !!formId,
  });

  // Review Mutation
  const reviewMutation = useMutation({
    mutationFn: ({ responseId, status, remarks }: any) =>
      formsAPI.reviewResponse(formId, responseId, status, remarks),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['form-responses', formId] });
      toast.success('Response review submitted!');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Failed to submit review');
    }
  });

  if (isLoadingForm || isLoadingResponses) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  const form = formData?.data;
  const responses = responsesData?.data?.items || [];
  const fields = form?.fields || [];

  // Export to CSV
  const handleExportCSV = () => {
    if (responses.length === 0) {
      toast.error('No responses to export');
      return;
    }

    // Headers
    const headers = ['Student Name', 'IC Number', 'Submitted At', ...fields.map((f: any) => f.label)];
    const rows = responses.map((r: any) => {
      const rowData = [
        r.user?.full_name || 'N/A',
        r.user?.ic_number || 'N/A',
        new Date(r.submitted_at).toLocaleString(),
        ...fields.map((f: any) => {
          const val = r.data?.[f.id];
          if (Array.isArray(val)) return `"${val.join(', ')}"`;
          if (typeof val === 'object') return `"${JSON.stringify(val)}"`;
          return `"${val || ''}"`;
        })
      ];
      return rowData.join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${form.title.replace(/\s+/g, '_')}_Responses.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('CSV Exported!');
  };

  // Trigger PDF print view
  const handlePrintPDF = () => {
    window.print();
  };

  // Compute stats for choices fields
  const computeStats = (field: any) => {
    const stats: Record<string, number> = {};
    if (field.type === 'yes_no') {
      stats['Yes'] = 0;
      stats['No'] = 0;
    } else if (field.options) {
      field.options.forEach((opt: string) => {
        stats[opt] = 0;
      });
    }

    responses.forEach((r: any) => {
      const val = r.data?.[field.id];
      if (Array.isArray(val)) {
        val.forEach((v: string) => {
          if (v) stats[v] = (stats[v] || 0) + 1;
        });
      } else if (val) {
        stats[val] = (stats[val] || 0) + 1;
      }
    });

    return stats;
  };

  const currentResponse = responses[individualIndex];

  return (
    <div className="space-y-6">
      {/* Print styles */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #print-area, #print-area * {
            visibility: visible;
          }
          #print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
        }
      `}</style>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/dashboard/forms')} className="p-2 rounded-lg bg-white dark:bg-dark-800 border border-dark-200 dark:border-dark-700 hover:bg-dark-50 dark:hover:bg-dark-750">
            <ArrowLeft className="w-4 h-4 text-dark-500" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-dark-900 dark:text-white">{form.title}</h1>
            <p className="text-sm text-dark-500 mt-1">{responses.length} Submissions received</p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end md:self-auto">
          <button onClick={handleExportCSV} className="btn-secondary flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-green-600" /> Export CSV
          </button>
          <button onClick={handlePrintPDF} className="btn-secondary flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary-500" /> Print / PDF
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-dark-200 dark:border-dark-700">
        <button
          onClick={() => setActiveTab('summary')}
          className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'summary'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-dark-500 hover:text-dark-700 dark:hover:text-dark-300'
          }`}
        >
          <BarChart2 className="w-4 h-4" /> Summary Statistics
        </button>
        <button
          onClick={() => setActiveTab('individual')}
          className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'individual'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-dark-500 hover:text-dark-700 dark:hover:text-dark-300'
          }`}
        >
          <User className="w-4 h-4" /> Individual Responses
        </button>
      </div>

      {/* Main Content Area */}
      <div id="print-area">
        {activeTab === 'summary' ? (
          <div className="space-y-6">
            {/* Form info card */}
            <div className="bg-white dark:bg-dark-800 rounded-2xl p-6 border border-dark-200 dark:border-dark-700">
              <h3 className="font-semibold text-dark-900 dark:text-white mb-2">Form Description</h3>
              <p className="text-dark-500 text-sm whitespace-pre-wrap">{form.description || 'No description provided'}</p>
            </div>

            {/* Fields summaries */}
            <div className="space-y-6">
              {fields.map((field: any, index: number) => {
                const isChoice = ['dropdown', 'radio', 'checkbox', 'yes_no'].includes(field.type);
                const stats = isChoice ? computeStats(field) : null;
                const totalAnswers = responses.filter((r: any) => r.data?.[field.id]).length;

                return (
                  <div key={field.id} className="bg-white dark:bg-dark-800 rounded-2xl p-6 border border-dark-200 dark:border-dark-700">
                    <div className="flex items-center justify-between mb-4 border-b border-dark-100 dark:border-dark-700 pb-3">
                      <h4 className="font-medium text-dark-900 dark:text-white flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 flex items-center justify-center text-xs font-bold font-mono">
                          {index + 1}
                        </span>
                        {field.label}
                      </h4>
                      <span className="text-xs text-dark-400">{totalAnswers} responses</span>
                    </div>

                    {/* Stats for Choice Fields */}
                    {isChoice && stats && (
                      <div className="space-y-4">
                        {Object.entries(stats).map(([option, count]) => {
                          const percentage = totalAnswers > 0 ? Math.round((count / totalAnswers) * 100) : 0;
                          return (
                            <div key={option} className="space-y-1">
                              <div className="flex justify-between text-sm">
                                <span className="text-dark-700 dark:text-dark-300 font-medium">{option}</span>
                                <span className="text-dark-500">{count} ({percentage}%)</span>
                              </div>
                              <div className="w-full h-3 bg-dark-100 dark:bg-dark-700 rounded-full overflow-hidden">
                                <div className="h-full bg-primary-500 rounded-full" style={{ width: `${percentage}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Text Field Responses list */}
                    {!isChoice && (
                      <div className="max-h-60 overflow-y-auto space-y-2 pr-2">
                        {responses.map((r: any) => {
                          const val = r.data?.[field.id];
                          if (!val) return null;
                          return (
                            <div key={r.id} className="p-3 bg-dark-50 dark:bg-dark-850 rounded-xl text-sm border border-dark-100 dark:border-dark-750 flex items-start gap-3">
                              <div className="w-6 h-6 rounded-full bg-dark-200 dark:bg-dark-700 flex items-center justify-center flex-shrink-0 text-[10px] text-dark-600 dark:text-dark-300 font-bold">
                                {r.user?.full_name?.substring(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <p className="text-dark-800 dark:text-dark-200 font-medium">{val}</p>
                                <span className="text-[10px] text-dark-400 block mt-1">
                                  By {r.user?.full_name} ({r.user?.ic_number})
                                </span>
                              </div>
                            </div>
                          );
                        })}
                        {totalAnswers === 0 && (
                          <p className="text-center text-sm text-dark-400 py-4">No answers provided for this field</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {responses.length === 0 ? (
              <div className="bg-white dark:bg-dark-800 rounded-2xl p-12 border border-dark-200 dark:border-dark-700 text-center text-dark-400">
                No submissions available
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                {/* Left side: Response Navigator and Student details */}
                <div className="lg:col-span-1 space-y-6">
                  <div className="bg-white dark:bg-dark-800 rounded-2xl p-6 border border-dark-200 dark:border-dark-700">
                    <div className="flex items-center justify-between mb-6">
                      <span className="text-sm font-medium text-dark-500">
                        {individualIndex + 1} of {responses.length} responses
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          disabled={individualIndex === 0}
                          onClick={() => { setIndividualIndex(individualIndex - 1); setAdminRemarks(responses[individualIndex - 1]?.admin_remarks || ''); }}
                          className="p-2 rounded-lg bg-dark-50 dark:bg-dark-750 hover:bg-dark-100 disabled:opacity-40"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                          disabled={individualIndex === responses.length - 1}
                          onClick={() => { setIndividualIndex(individualIndex + 1); setAdminRemarks(responses[individualIndex + 1]?.admin_remarks || ''); }}
                          className="p-2 rounded-lg bg-dark-50 dark:bg-dark-750 hover:bg-dark-100 disabled:opacity-40"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 mb-6 p-4 bg-dark-50 dark:bg-dark-850 rounded-2xl border border-dark-100 dark:border-dark-750">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white font-bold text-lg">
                        {currentResponse.user?.full_name?.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-semibold text-dark-900 dark:text-white">{currentResponse.user?.full_name}</h4>
                        <p className="text-xs text-dark-500 mt-0.5">{currentResponse.user?.ic_number}</p>
                      </div>
                    </div>

                    <div className="space-y-3 text-sm text-dark-500">
                      <div className="flex justify-between">
                        <span>Submitted on:</span>
                        <span className="font-medium text-dark-800 dark:text-white">
                          {new Date(currentResponse.submitted_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Review Status:</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          currentResponse.status === 'approved' ? 'bg-green-100 text-green-700 dark:bg-green-900/30' :
                          currentResponse.status === 'rejected' ? 'bg-red-100 text-red-700 dark:bg-red-900/30' :
                          'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30'
                        }`}>
                          {currentResponse.status}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Review control card */}
                  <div className="bg-white dark:bg-dark-800 rounded-2xl p-6 border border-dark-200 dark:border-dark-700">
                    <h3 className="font-semibold text-dark-900 dark:text-white mb-4">Review Response</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-medium text-dark-500 mb-1.5">Admin Remarks</label>
                        <textarea
                          value={adminRemarks}
                          onChange={(e) => setAdminRemarks(e.target.value)}
                          placeholder="Add feedback or review notes..."
                          className="input-field"
                          rows={3}
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => reviewMutation.mutate({ responseId: currentResponse.id, status: 'approved', remarks: adminRemarks })}
                          disabled={reviewMutation.isPending}
                          className="btn-success text-sm flex-1 flex items-center justify-center gap-1.5"
                        >
                          <Check className="w-4 h-4" /> Approve
                        </button>
                        <button
                          onClick={() => reviewMutation.mutate({ responseId: currentResponse.id, status: 'rejected', remarks: adminRemarks })}
                          disabled={reviewMutation.isPending}
                          className="btn-danger text-sm flex-1 flex items-center justify-center gap-1.5"
                        >
                          <X className="w-4 h-4" /> Reject
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right side: Field values */}
                <div className="lg:col-span-2 bg-white dark:bg-dark-800 rounded-2xl p-6 border border-dark-200 dark:border-dark-700 space-y-6">
                  <h3 className="font-bold text-lg text-dark-900 dark:text-white border-b border-dark-100 dark:border-dark-700 pb-3">
                    Answers
                  </h3>

                  <div className="space-y-6">
                    {fields.map((field: any) => {
                      const val = currentResponse.data?.[field.id];
                      const isFile = ['file', 'image', 'pdf', 'ppt', 'document'].includes(field.type);

                      return (
                        <div key={field.id} className="space-y-1.5">
                          <label className="text-sm font-medium text-dark-500">{field.label}</label>
                          <div className="p-4 bg-dark-50 dark:bg-dark-850 rounded-xl border border-dark-100 dark:border-dark-750">
                            {isFile ? (
                              val ? (
                                <a
                                  href={val}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary-500 hover:text-primary-600 font-medium inline-flex items-center gap-1.5 text-sm"
                                >
                                  <Download className="w-4 h-4" /> Download File Attachment
                                </a>
                              ) : (
                                <span className="text-dark-400 text-sm italic">No file uploaded</span>
                              )
                            ) : Array.isArray(val) ? (
                              <div className="flex flex-wrap gap-1.5">
                                {val.map((v: string) => (
                                  <span key={v} className="px-2 py-0.5 bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400 text-xs font-medium rounded">
                                    {v}
                                  </span>
                                ))}
                                {val.length === 0 && <span className="text-dark-400 text-sm italic">No selections</span>}
                              </div>
                            ) : val ? (
                              <p className="text-dark-900 dark:text-white text-sm whitespace-pre-wrap">{val}</p>
                            ) : (
                              <p className="text-dark-400 text-sm italic">Empty response</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
