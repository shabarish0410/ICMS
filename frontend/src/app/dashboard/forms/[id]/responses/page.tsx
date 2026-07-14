'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { formsAPI } from '@/services/api';
import { Loader2, ArrowLeft, Download, FileText, CheckCircle, Clock } from 'lucide-react';

export default function FormResponsesPage() {
  const { id } = useParams();
  const router = useRouter();
  
  const [activeTab, setActiveTab] = useState('summary'); // 'summary', 'individual'
  const [page, setPage] = useState(1);
  const size = 20;

  const { data: formData, isLoading: formLoading } = useQuery({
    queryKey: ['forms', id],
    queryFn: () => formsAPI.get(Number(id))
  });

  const { data: responsesData, isLoading: responsesLoading } = useQuery({
    queryKey: ['forms', id, 'responses', page],
    queryFn: () => formsAPI.responses(Number(id), { page, size })
  });

  if (formLoading || responsesLoading) return <div className="flex justify-center p-20"><Loader2 className="w-8 h-8 animate-spin text-primary-500" /></div>;

  const form = formData?.data;
  const responses = responsesData?.data?.items || [];
  const totalResponses = responsesData?.data?.total || 0;

  // Simple analytics logic
  const completed = responses.filter((r: any) => r.status === 'Completed').length;
  const pending = totalResponses - completed;

  return (
    <div className="max-w-6xl mx-auto pb-20">
      <button onClick={() => router.push('/dashboard/forms')} className="flex items-center gap-2 text-dark-500 hover:text-dark-900 dark:hover:text-white mb-6 transition-colors font-medium">
        <ArrowLeft className="w-4 h-4" /> Back to Forms
      </button>

      <div className="bg-white dark:bg-dark-800 rounded-2xl p-6 border border-dark-200 dark:border-dark-700 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-dark-900 dark:text-white">{form?.title} - Responses</h1>
          <p className="text-sm text-dark-500 mt-1">{totalResponses} total responses</p>
        </div>
        <div className="flex gap-3">
          <button className="btn-secondary flex items-center gap-2 text-sm"><Download className="w-4 h-4" /> CSV</button>
          <button className="btn-secondary flex items-center gap-2 text-sm text-green-600 border-green-200 bg-green-50"><FileText className="w-4 h-4" /> Excel</button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
        <div className="bg-white dark:bg-dark-800 rounded-2xl p-5 border border-dark-200 dark:border-dark-700 flex items-center gap-4">
          <div className="p-3 bg-primary-100 text-primary-600 rounded-xl"><FileText className="w-6 h-6" /></div>
          <div>
            <p className="text-sm font-medium text-dark-500">Total Responses</p>
            <h3 className="text-2xl font-bold text-dark-900 dark:text-white">{totalResponses}</h3>
          </div>
        </div>
        <div className="bg-white dark:bg-dark-800 rounded-2xl p-5 border border-dark-200 dark:border-dark-700 flex items-center gap-4">
          <div className="p-3 bg-green-100 text-green-600 rounded-xl"><CheckCircle className="w-6 h-6" /></div>
          <div>
            <p className="text-sm font-medium text-dark-500">Completed</p>
            <h3 className="text-2xl font-bold text-dark-900 dark:text-white">{completed}</h3>
          </div>
        </div>
        <div className="bg-white dark:bg-dark-800 rounded-2xl p-5 border border-dark-200 dark:border-dark-700 flex items-center gap-4">
          <div className="p-3 bg-yellow-100 text-yellow-600 rounded-xl"><Clock className="w-6 h-6" /></div>
          <div>
            <p className="text-sm font-medium text-dark-500">Pending Review</p>
            <h3 className="text-2xl font-bold text-dark-900 dark:text-white">{pending}</h3>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-dark-800 rounded-2xl border border-dark-200 dark:border-dark-700 shadow-sm overflow-hidden">
        <div className="flex border-b border-dark-100 dark:border-dark-700">
          <button onClick={() => setActiveTab('summary')} className={`px-6 py-4 font-semibold text-sm transition-colors ${activeTab === 'summary' ? 'text-primary-500 border-b-2 border-primary-500' : 'text-dark-500 hover:text-dark-800 dark:hover:text-dark-200'}`}>Summary</button>
          <button onClick={() => setActiveTab('individual')} className={`px-6 py-4 font-semibold text-sm transition-colors ${activeTab === 'individual' ? 'text-primary-500 border-b-2 border-primary-500' : 'text-dark-500 hover:text-dark-800 dark:hover:text-dark-200'}`}>Individual Responses</button>
        </div>

        <div className="p-6">
          {activeTab === 'summary' ? (
            <div className="space-y-8">
              {form?.questions?.map((q: any) => {
                // Extremely basic summary visualization just for layout mockup
                return (
                  <div key={q.id} className="border border-dark-200 dark:border-dark-700 rounded-xl p-5">
                    <h4 className="font-semibold text-dark-900 dark:text-white mb-4">{q.question} <span className="text-dark-400 font-normal text-sm ml-2">{totalResponses} responses</span></h4>
                    
                    {['Short Answer', 'Paragraph'].includes(q.type) ? (
                      <div className="bg-dark-50 dark:bg-dark-900 rounded-lg p-4 max-h-40 overflow-y-auto space-y-3">
                        {responses.slice(0,5).map((r: any, i: number) => {
                          const ans = r.answers?.find((a:any) => a.question_id === q.id);
                          return ans?.answer ? <div key={i} className="bg-white dark:bg-dark-800 p-2 rounded border border-dark-200 dark:border-dark-700 text-sm">{ans.answer}</div> : null;
                        })}
                      </div>
                    ) : q.type === 'File Upload' ? (
                      <div className="text-sm text-dark-500">File uploads can be viewed in the Individual tab.</div>
                    ) : (
                      <div className="space-y-2">
                        {/* Fake progress bars for dropdown/radio visualization */}
                        {q.options?.map((opt: any) => {
                          const count = responses.filter((r:any) => r.answers?.find((a:any) => a.question_id === q.id && a.answer === opt.option_text)).length;
                          const percent = totalResponses ? Math.round((count/totalResponses)*100) : 0;
                          return (
                            <div key={opt.id} className="flex items-center gap-3">
                              <span className="w-1/3 text-sm text-dark-700 dark:text-dark-200 truncate">{opt.option_text}</span>
                              <div className="flex-1 bg-dark-100 dark:bg-dark-700 h-6 rounded overflow-hidden">
                                <div className="bg-primary-500 h-full" style={{ width: `${percent}%` }}></div>
                              </div>
                              <span className="w-12 text-sm font-medium text-dark-500">{count}</span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-dark-500 uppercase bg-dark-50 dark:bg-dark-800/50">
                  <tr>
                    <th className="px-4 py-3">Student Name</th>
                    <th className="px-4 py-3">IC Number</th>
                    <th className="px-4 py-3">Submitted On</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {responses.map((r: any) => (
                    <tr key={r.id} className="border-b border-dark-100 dark:border-dark-750">
                      <td className="px-4 py-4 font-medium text-dark-900 dark:text-white">{r.student?.user?.full_name || 'Anonymous'}</td>
                      <td className="px-4 py-4">{r.student?.ic_number || '-'}</td>
                      <td className="px-4 py-4">{new Date(r.submitted_at).toLocaleString()}</td>
                      <td className="px-4 py-4">
                        <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-green-100 text-green-700">{r.status}</span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <button className="text-primary-500 hover:underline font-medium text-sm">View Details</button>
                      </td>
                    </tr>
                  ))}
                  {responses.length === 0 && (
                    <tr><td colSpan={5} className="text-center py-8 text-dark-400">No responses yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
