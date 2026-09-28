'use client';

import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Phone,
  MessageSquare,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Filter,
  Check,
  ChevronDown,
  ChevronUp,
  X,
  FileText,
  UserCheck,
  ListTodo,
  Plus,
  ArrowRight,
  ShieldCheck,
  Tag,
  Pencil,
} from 'lucide-react';
import { getFollowUps, completeFollowUp, type FollowUpFilter, type FollowUpItem } from '@/lib/actions/operations';
import { getTasks, createTask, updateTaskStatus, type TaskViewScope } from '@/lib/actions/tasks';
import type { EnquiryStatus, ERPTask, TaskType, TaskPriority, TaskStatus } from '@/types/erp';
import EditTaskModal from '@/components/modals/EditTaskModal';

export default function FollowUpsPage() {
  const [activeMainTab, setActiveMainTab] = useState<'TASKS' | 'ENQUIRIES'>('TASKS');

  // Tasks State
  const [tasks, setTasks] = useState<ERPTask[]>([]);
  const [taskScope, setTaskScope] = useState<TaskViewScope>('ALL');
  const [taskLoading, setTaskLoading] = useState(true);

  // New Task Modal State
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<ERPTask | null>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskType, setTaskType] = useState<TaskType>('QUOTATION_FOLLOWUP');
  const [taskPriority, setTaskPriority] = useState<TaskPriority>('HIGH');
  const [taskAssignedTo, setTaskAssignedTo] = useState('B Vineet Babu');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskNotes, setTaskNotes] = useState('');
  const [taskSubmitting, setTaskSubmitting] = useState(false);

  // Complete Task Modal State
  const [selectedTask, setSelectedTask] = useState<ERPTask | null>(null);
  const [taskOutcome, setTaskOutcome] = useState('');

  // Enquiry Follow-up State
  const [followUps, setFollowUps] = useState<FollowUpItem[]>([]);
  const [enquiryFilter, setEnquiryFilter] = useState<FollowUpFilter>('ALL');
  const [enquiryLoading, setEnquiryLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedEnquiry, setSelectedEnquiry] = useState<FollowUpItem | null>(null);
  const [modalOutcome, setModalOutcome] = useState<string>('Call Connected');
  const [modalNotes, setModalNotes] = useState('');
  const [modalNextDate, setModalNextDate] = useState('');
  const [modalStatus, setModalStatus] = useState<EnquiryStatus>('Follow up');
  const [isSubmittingEnquiry, setIsSubmittingEnquiry] = useState(false);

  const loadTasksData = async (scope: TaskViewScope) => {
    setTaskLoading(true);
    try {
      const res = await getTasks({ scope });
      setTasks(res.tasks || []);
    } catch (err) {
      console.error('Error loading tasks:', err);
    } finally {
      setTaskLoading(false);
    }
  };

  const loadEnquiriesData = async (activeFilter: FollowUpFilter) => {
    setEnquiryLoading(true);
    try {
      const data = await getFollowUps(activeFilter);
      setFollowUps(data);
    } catch (err) {
      console.error('Error fetching follow ups:', err);
    } finally {
      setEnquiryLoading(false);
    }
  };

  useEffect(() => {
    loadTasksData(taskScope);
  }, [taskScope]);

  useEffect(() => {
    loadEnquiriesData(enquiryFilter);
  }, [enquiryFilter]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle || !taskDueDate) return;
    setTaskSubmitting(true);
    try {
      const res = await createTask({
        task_type: taskType,
        title: taskTitle,
        assigned_user_name: taskAssignedTo,
        priority: taskPriority,
        due_date: taskDueDate,
        notes: taskNotes,
      });
      if (res.success) {
        setIsTaskModalOpen(false);
        setTaskTitle('');
        setTaskNotes('');
        await loadTasksData(taskScope);
      } else {
        alert(res.error || 'Failed to create task');
      }
    } catch (err) {
      console.error('Task creation error:', err);
    } finally {
      setTaskSubmitting(false);
    }
  };

  const handleCompleteTask = async () => {
    if (!selectedTask) return;
    try {
      const res = await updateTaskStatus(selectedTask.id, 'Completed', taskOutcome);
      if (res.success) {
        setSelectedTask(null);
        setTaskOutcome('');
        await loadTasksData(taskScope);
      } else {
        alert(res.error || 'Failed to complete task');
      }
    } catch (err) {
      console.error('Error updating task:', err);
    }
  };

  const handleSaveEnquiryAction = async () => {
    if (!selectedEnquiry || !modalNotes.trim()) return;
    setIsSubmittingEnquiry(true);
    try {
      await completeFollowUp({
        enquiryId: selectedEnquiry.id,
        notes: modalNotes.trim(),
        authorName: 'Current User',
        nextFollowUpDate: modalNextDate || undefined,
        newStatus: modalStatus,
        outcome: modalOutcome as any,
      });
      setSelectedEnquiry(null);
      await loadEnquiriesData(enquiryFilter);
    } catch (err) {
      console.error('Failed to complete follow up:', err);
    } finally {
      setIsSubmittingEnquiry(false);
    }
  };

  const overdueTasksCount = tasks.filter(
    (t) => t.due_date < new Date().toISOString().split('T')[0] && t.status !== 'Completed'
  ).length;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <ListTodo className="w-6 h-6 text-indigo-600" />
              Follow-up & Task Automation
            </h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Centrally manage quotation follow-ups, payment collections, installations, and enquiry pipelines
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setActiveMainTab('TASKS')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                activeMainTab === 'TASKS'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Operational Tasks ({tasks.length})
            </button>
            <button
              onClick={() => setActiveMainTab('ENQUIRIES')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                activeMainTab === 'ENQUIRIES'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Presales Enquiries ({followUps.length})
            </button>
          </div>

          {activeMainTab === 'TASKS' && (
            <button
              onClick={() => {
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                setTaskDueDate(tomorrow.toISOString().split('T')[0]);
                setIsTaskModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Task
            </button>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* TAB 1: OPERATIONAL TASKS HUB */}
      {/* ------------------------------------------------------------- */}
      {activeMainTab === 'TASKS' && (
        <div className="space-y-4">
          {/* Scope Filters */}
          <div className="flex flex-wrap items-center gap-2 bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
            {[
              { id: 'ALL', label: 'All Tasks' },
              { id: 'MY_TASKS', label: 'My Tasks' },
              { id: 'OVERDUE', label: `Overdue (${overdueTasksCount})` },
              { id: 'TODAY', label: "Due Today" },
              { id: 'UPCOMING', label: 'Upcoming' },
              { id: 'COMPLETED', label: 'Completed' },
            ].map((s) => (
              <button
                key={s.id}
                onClick={() => setTaskScope(s.id as TaskViewScope)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  taskScope === s.id
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Task Cards / Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="divide-y divide-slate-100">
              {taskLoading ? (
                <div className="p-8 text-center text-slate-400 text-sm">Loading tasks...</div>
              ) : tasks.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm">No tasks in this view.</div>
              ) : (
                tasks.map((task) => {
                  const isOverdue =
                    task.due_date < new Date().toISOString().split('T')[0] && task.status !== 'Completed';

                  return (
                    <div
                      key={task.id}
                      className="p-4 hover:bg-slate-50/70 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-slate-500 font-semibold">{task.task_number}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700">
                            {task.task_type.replace('_', ' ')}
                          </span>
                          {task.priority === 'URGENT' && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                              URGENT
                            </span>
                          )}
                          {task.priority === 'HIGH' && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                              HIGH
                            </span>
                          )}
                        </div>
                        <h4 className="font-bold text-slate-900 text-sm">{task.title}</h4>
                        {task.notes && <p className="text-xs text-slate-500">{task.notes}</p>}
                        {task.outcome && (
                          <div className="text-xs text-emerald-700 bg-emerald-50 px-2 py-1 rounded inline-block">
                            Outcome: {task.outcome}
                          </div>
                        )}
                        <div className="flex items-center gap-4 text-xs text-slate-500 pt-1">
                          <span className="flex items-center gap-1">
                            <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                            {task.assigned_user_name}
                          </span>
                          <span className={`flex items-center gap-1 font-medium ${isOverdue ? 'text-rose-600' : ''}`}>
                            <Calendar className="w-3.5 h-3.5" />
                            Due: {task.due_date} {isOverdue && '(Overdue)'}
                          </span>
                          {task.related_entity_number && (
                            <span className="font-mono text-slate-400">Ref: {task.related_entity_number}</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {task.status !== 'Completed' ? (
                          <>
                            <button
                              onClick={() => setEditingTask(task)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 transition-colors"
                              title="Edit Task Details"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              <span>Edit</span>
                            </button>
                            <button
                              onClick={() => {
                                setSelectedTask(task);
                                setTaskOutcome('');
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Complete Task</span>
                            </button>
                          </>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold bg-slate-100 text-slate-600">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            Completed
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 2: PRESALES ENQUIRY QUEUE */}
      {/* ------------------------------------------------------------- */}
      {activeMainTab === 'ENQUIRIES' && (
        <div className="space-y-4">
          {/* Filter Pills */}
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'ALL', label: 'All Active' },
              { id: 'TODAY', label: "Today's Follow-ups" },
              { id: 'OVERDUE', label: 'Overdue Follow-ups' },
              { id: 'HIGH_VALUE', label: 'High-Value (≥ ₹1L)' },
              { id: 'EXPIRING_SOON', label: 'Quotes Expiring Soon' },
              { id: 'PAYMENT_OVERDUE', label: 'Payment Overdue' },
              { id: 'SITE_VISIT_PENDING', label: 'Demo & Site-Visit Pending' },
              { id: 'APPROVAL_PENDING', label: 'Client Approvals Pending' },
              { id: 'COMPLETED', label: 'Completed History' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setEnquiryFilter(tab.id as FollowUpFilter)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors ${
                  enquiryFilter === tab.id
                    ? 'bg-slate-900 border-slate-900 text-white'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Enquiries List */}
          <div className="space-y-3">
            {enquiryLoading ? (
              <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-400">
                Loading follow-ups...
              </div>
            ) : followUps.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-400">
                No enquiry actions found for this view.
              </div>
            ) : (
              followUps.map((item) => {
                const isExpanded = expandedId === item.id;
                return (
                  <div
                    key={item.id}
                    className={`bg-white rounded-xl border transition-all p-4 ${
                      item.is_overdue
                        ? 'border-rose-200 bg-rose-50/20'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-slate-500">{item.enquiry_number}</span>
                          <span className="font-bold text-slate-900 text-sm">{item.customer_name}</span>
                          {item.company_name && (
                            <span className="text-xs text-slate-500">({item.company_name})</span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 mt-1">{item.requirement}</p>
                        <div className="flex items-center gap-4 text-xs text-slate-500 mt-2">
                          <span className="flex items-center gap-1 font-medium">
                            <Calendar className="w-3 h-3" />
                            {item.follow_up_date}
                          </span>
                          <span className="flex items-center gap-1">
                            <UserCheck className="w-3 h-3" />
                            {item.salesperson_name}
                          </span>
                          <span className="flex items-center gap-1 font-mono">
                            <Phone className="w-3 h-3" />
                            {item.phone}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <a
                          href={`tel:${item.phone.replace(/[^0-9]/g, '')}`}
                          title="Direct Phone Call"
                          className="min-h-[38px] px-3.5 py-1.5 text-xs font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-xl flex items-center gap-1.5 transition"
                        >
                          <Phone className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Call</span>
                        </a>

                        <a
                          href={`https://wa.me/${item.phone.replace(/[^0-9]/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="WhatsApp Chat"
                          className="min-h-[38px] px-3.5 py-1.5 text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl flex items-center gap-1.5 transition shadow-xs"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>WhatsApp</span>
                        </a>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedEnquiry(item);
                            setModalNotes('Call completed and customer satisfied.');
                            setModalStatus('Order done');
                          }}
                          className="min-h-[38px] px-3.5 py-1.5 text-xs font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-xl flex items-center gap-1.5 transition"
                          title="Complete Follow-up"
                        >
                          <Check className="w-3.5 h-3.5 text-blue-600" />
                          <span>Complete</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedEnquiry(item);
                            setModalNotes('');
                            const nextWeek = new Date();
                            nextWeek.setDate(nextWeek.getDate() + 3);
                            setModalNextDate(nextWeek.toISOString().split('T')[0]);
                            setModalStatus((item.status as EnquiryStatus) || 'Follow up');
                          }}
                          className="min-h-[38px] px-3.5 py-1.5 text-xs font-bold bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition shadow-xs flex items-center gap-1.5"
                          title="Reschedule Next Date"
                        >
                          <Clock className="w-3.5 h-3.5" />
                          <span>Reschedule</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* CREATE TASK MODAL */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-600" />
                Create Operational Task
              </h3>
              <button
                onClick={() => setIsTaskModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Task Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Follow up on Projector quotation"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Task Category</label>
                  <select
                    value={taskType}
                    onChange={(e) => setTaskType(e.target.value as TaskType)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500"
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
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Priority</label>
                  <select
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value as TaskPriority)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500"
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
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Assigned To</label>
                  <select
                    value={taskAssignedTo}
                    onChange={(e) => setTaskAssignedTo(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <option value="B Vineet Babu">B Vineet Babu (Sales Executive)</option>
                    <option value="B V Dheeraj Reddy">B V Dheeraj Reddy (Sales / Admin)</option>
                    <option value="Reshma">Reshma (Sales Executive)</option>
                    <option value="Hemalath">Hemalath (Accounts)</option>
                    <option value="Manisha">Manisha (Office Assistant)</option>
                    <option value="Borra Narsimulu">Borra Narsimulu (Managing Director)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Due Date</label>
                  <input
                    type="date"
                    required
                    value={taskDueDate}
                    onChange={(e) => setTaskDueDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Notes & Context</label>
                <textarea
                  rows={3}
                  placeholder="Key instructions or background context..."
                  value={taskNotes}
                  onChange={(e) => setTaskNotes(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsTaskModalOpen(false)}
                  className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={taskSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50"
                >
                  {taskSubmitting ? 'Saving...' : 'Save Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* COMPLETE TASK MODAL */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Complete Task
              </h3>
              <button
                onClick={() => setSelectedTask(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <p className="text-xs text-slate-500 font-medium">Task: {selectedTask.title}</p>
                <p className="text-xs text-slate-400 font-mono mt-0.5">{selectedTask.task_number}</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Completion Outcome / Notes
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Spoke with client procurement head, received confirmation on payment release next Monday."
                  value={taskOutcome}
                  onChange={(e) => setTaskOutcome(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedTask(null)}
                  className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCompleteTask}
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg"
                >
                  Mark as Completed
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* COMPLETE ENQUIRY MODAL */}
      {selectedEnquiry && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                Update Follow-up for {selectedEnquiry.customer_name}
              </h3>
              <button
                onClick={() => setSelectedEnquiry(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Follow-up Outcome *</label>
                <select
                  value={modalOutcome}
                  onChange={(e) => setModalOutcome(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 font-bold bg-white text-slate-800 focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="Call Connected">📞 Call Connected</option>
                  <option value="WhatsApp Sent">💬 WhatsApp Sent</option>
                  <option value="Meeting Done">🤝 Meeting Done</option>
                  <option value="Follow-up Rescheduled">📅 Follow-up Rescheduled</option>
                  <option value="Converted to Order">🎉 Converted to Order</option>
                  <option value="Lost to Competitor">❌ Lost to Competitor</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">Call / Action Notes</label>
                  <span className="text-[10px] text-slate-400">Tap chip to prefill</span>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {[
                    'Spoke with customer — requested revision',
                    'Busy in meeting — call back tomorrow',
                    'Shared quotation on WhatsApp',
                    'Site visit requested for room survey',
                    'Ready to confirm PO — final review',
                  ].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setModalNotes((prev) => (prev ? `${prev}. ${chip}` : chip))}
                      className="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-medium transition cursor-pointer"
                    >
                      + {chip}
                    </button>
                  ))}
                </div>
                <textarea
                  rows={3}
                  value={modalNotes}
                  onChange={(e) => setModalNotes(e.target.value)}
                  placeholder="Discussion details..."
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700">Next Follow-up</label>
                  </div>
                  <div className="flex items-center gap-1 mb-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date();
                        d.setDate(d.getDate() + 1);
                        setModalNextDate(d.toISOString().split('T')[0]);
                      }}
                      className="px-1.5 py-0.5 rounded bg-brand-50 hover:bg-brand-100 text-brand-700 font-bold text-[10px] border border-brand-200"
                    >
                      +1D
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date();
                        d.setDate(d.getDate() + 3);
                        setModalNextDate(d.toISOString().split('T')[0]);
                      }}
                      className="px-1.5 py-0.5 rounded bg-brand-50 hover:bg-brand-100 text-brand-700 font-bold text-[10px] border border-brand-200"
                    >
                      +3D
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date();
                        d.setDate(d.getDate() + 7);
                        setModalNextDate(d.toISOString().split('T')[0]);
                      }}
                      className="px-1.5 py-0.5 rounded bg-brand-50 hover:bg-brand-100 text-brand-700 font-bold text-[10px] border border-brand-200"
                    >
                      +1W
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date();
                        d.setMonth(d.getMonth() + 1);
                        setModalNextDate(d.toISOString().split('T')[0]);
                      }}
                      className="px-1.5 py-0.5 rounded bg-brand-50 hover:bg-brand-100 text-brand-700 font-bold text-[10px] border border-brand-200"
                    >
                      +1M
                    </button>
                  </div>
                  <input
                    type="date"
                    value={modalNextDate}
                    onChange={(e) => setModalNextDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Pipeline Status</label>
                  <select
                    value={modalStatus}
                    onChange={(e) => setModalStatus(e.target.value as EnquiryStatus)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Follow up">Follow up</option>
                    <option value="Quotation sent">Quotation sent</option>
                    <option value="Order done">Order done</option>
                    <option value="Lost">Lost</option>
                    <option value="Closed">Closed</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedEnquiry(null)}
                  className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSubmittingEnquiry || !modalNotes.trim()}
                  onClick={handleSaveEnquiryAction}
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50"
                >
                  {isSubmittingEnquiry ? 'Saving...' : 'Save & Reschedule'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Edit Task Modal */}
      <EditTaskModal
        isOpen={!!editingTask}
        onClose={() => setEditingTask(null)}
        task={editingTask}
        onSuccess={() => loadTasksData(taskScope)}
      />
    </div>
  );
}
