'use client';

import React, { useState, useEffect } from 'react';
import { X, Save, AlertTriangle, Calendar, UserCheck, ShieldCheck } from 'lucide-react';
import type { ERPTask, TaskPriority, TaskType } from '@/types/erp';
import { updateTask } from '@/lib/actions/tasks';

interface EditTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: ERPTask | null;
  onSuccess: () => void;
}

export default function EditTaskModal({
  isOpen,
  onClose,
  task,
  onSuccess,
}: EditTaskModalProps) {
  const [formData, setFormData] = useState({
    title: '',
    task_type: 'QUOTATION_FOLLOWUP' as TaskType,
    priority: 'MEDIUM' as TaskPriority,
    assigned_user_name: '',
    due_date: '',
    notes: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (task) {
      setFormData({
        title: task.title || '',
        task_type: task.task_type || 'QUOTATION_FOLLOWUP',
        priority: task.priority || 'MEDIUM',
        assigned_user_name: task.assigned_user_name || '',
        due_date: task.due_date || new Date().toISOString().split('T')[0],
        notes: task.notes || '',
      });
      setErrorMessage(null);
    }
  }, [task]);

  if (!isOpen || !task) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await updateTask(task.id, {
        title: formData.title.trim(),
        task_type: formData.task_type,
        priority: formData.priority,
        assigned_user_name: formData.assigned_user_name.trim(),
        due_date: formData.due_date,
        notes: formData.notes.trim(),
      });

      if (res.success) {
        onSuccess();
        onClose();
      } else {
        setErrorMessage(res.error || 'Failed to update task');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'An unexpected error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-4 text-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span>Edit Operational Task</span>
              <span className="font-mono text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                {task.task_number}
              </span>
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Update task assignment, priority, timeline & instructions
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block font-semibold mb-1 text-slate-700">Task Title *</label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1 text-slate-700">Task Category</label>
              <select
                value={formData.task_type}
                onChange={(e) => setFormData({ ...formData, task_type: e.target.value as TaskType })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
              >
                <option value="QUOTATION_FOLLOWUP">Quotation Follow-up</option>
                <option value="PAYMENT_COLLECTION">Payment Collection</option>
                <option value="PROCUREMENT_FOLLOWUP">Procurement / PO</option>
                <option value="INSTALLATION_FOLLOWUP">Installation Follow-up</option>
                <option value="AMC_RENEWAL">AMC Renewal</option>
                <option value="SERVICE_FOLLOWUP">Service Ticket</option>
                <option value="CUSTOMER_FOLLOWUP">Customer General</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1 text-slate-700">Priority</label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value as TaskPriority })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1 text-slate-700">Assigned To *</label>
              <input
                type="text"
                required
                value={formData.assigned_user_name}
                onChange={(e) => setFormData({ ...formData, assigned_user_name: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1 text-slate-700">Due Date *</label>
              <input
                type="date"
                required
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold mb-1 text-slate-700">Notes & Context</label>
            <textarea
              rows={3}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2 text-[11px] text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Completed tasks are locked to preserve operational audit logs.</span>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition shadow-xs disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{submitting ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
