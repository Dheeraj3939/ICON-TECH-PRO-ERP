'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Search,
  Filter,
  Plus,
  MapPin,
  Mail,
  Phone,
  Building2,
  HardHat,
  ChevronRight,
  X,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  User,
  Users,
  Shield,
  LayoutGrid,
  List,
  ExternalLink,
} from 'lucide-react';
import type { Employee } from '@/types/hr';
import { createEmployee } from '@/lib/actions/employees';

interface EmployeeDirectoryClientProps {
  initialEmployees: Employee[];
  userRole: string;
}

export function EmployeeDirectoryClient({
  initialEmployees,
  userRole,
}: EmployeeDirectoryClientProps) {
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>(initialEmployees);
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [locationFilter, setLocationFilter] = useState('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const canAddEmployee = ['Managing Director', 'Admin / BDM'].includes(userRole);

  const [formData, setFormData] = useState({
    full_name: '',
    corporate_email: '',
    phone: '',
    department: 'Projects & Installations',
    designation: 'AV Installation Technician',
    employment_type: 'Technician' as Employee['employment_type'],
    work_location_type: 'Site' as Employee['work_location_type'],
    current_site_assignment: '',
    personal_email: '',
    address: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    skills: 'IFPD Installation, Cabling, Audio Setup',
    notes: '',
  });

  const filteredEmployees = employees.filter((emp) => {
    if (departmentFilter !== 'ALL' && emp.department !== departmentFilter) return false;
    if (locationFilter !== 'ALL' && emp.work_location_type !== locationFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      return (
        emp.full_name.toLowerCase().includes(q) ||
        emp.employee_id.toLowerCase().includes(q) ||
        emp.corporate_email.toLowerCase().includes(q) ||
        emp.designation.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const departments = Array.from(new Set(employees.map((e) => e.department)));

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await createEmployee({
        ...formData,
        joining_date: new Date().toISOString().split('T')[0],
        skills: formData.skills.split(',').map((s) => s.trim()).filter(Boolean),
      });

      if (!res.success || !res.employee) {
        setErrorMsg(res.error || 'Failed to create employee record.');
      } else {
        setSuccessMsg(`Employee ${res.employee.employee_id} created successfully!`);
        setEmployees((prev) => [...prev, res.employee!]);
        setTimeout(() => {
          setIsAddModalOpen(false);
          setSuccessMsg('');
        }, 1200);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Server authorization failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search & Filter Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search employees by name, ID (e.g. EMP-0001), designation, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Department Filter */}
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="ALL">All Departments</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          {/* Location Filter */}
          <select
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="ALL">All Locations</option>
            <option value="Office">Office Only</option>
            <option value="Site">Site Staff Only</option>
            <option value="Field">Field Staff Only</option>
            <option value="Hybrid">Hybrid</option>
          </select>

          {/* View Toggle */}
          <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              title="Card Grid View"
              className={`p-2 text-xs transition ${
                viewMode === 'grid' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              title="Table View"
              className={`p-2 text-xs transition ${
                viewMode === 'table' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Add Employee Action */}
          {canAddEmployee && (
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Add Employee</span>
            </button>
          )}
        </div>
      </div>

      {/* Grid View */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEmployees.map((emp) => {
            const isSite = emp.work_location_type === 'Site' || emp.work_location_type === 'Field';

            return (
              <div
                key={emp.id}
                className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover:shadow-md transition duration-200 flex flex-col justify-between group"
              >
                <div>
                  {/* Header row with ID badge and Location */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-mono text-[11px] font-bold border border-indigo-200/50">
                      {emp.employee_id}
                    </span>

                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        isSite
                          ? 'bg-amber-50 text-amber-700 border border-amber-200/60'
                          : 'bg-sky-50 text-sky-700 border border-sky-200/60'
                      }`}
                    >
                      {isSite ? <HardHat className="w-3 h-3" /> : <Building2 className="w-3 h-3" />}
                      <span>{emp.work_location_type}</span>
                    </span>
                  </div>

                  {/* Profile Avatar & Name */}
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-slate-800 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
                      {emp.full_name.charAt(0)}
                    </div>
                    <div className="overflow-hidden">
                      <h3 className="text-sm font-black text-slate-900 truncate group-hover:text-indigo-600 transition">
                        {emp.full_name}
                      </h3>
                      <p className="text-xs text-slate-500 font-medium truncate">{emp.designation}</p>
                      <p className="text-[11px] text-slate-400 truncate">{emp.department}</p>
                    </div>
                  </div>

                  {/* Contact & Assignment Snippets */}
                  <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs text-slate-600">
                    <div className="flex items-center gap-2 truncate">
                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{emp.corporate_email}</span>
                    </div>
                    <div className="flex items-center gap-2 truncate">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="font-mono">{emp.phone}</span>
                    </div>
                    {emp.current_site_assignment && (
                      <div className="flex items-center gap-2 text-amber-700 font-medium truncate bg-amber-50/70 p-1.5 rounded-lg text-[11px]">
                        <MapPin className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{emp.current_site_assignment}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Footer */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] font-medium text-emerald-600 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>{emp.status}</span>
                  </span>

                  <div className="flex items-center gap-2">
                    {canAddEmployee && (
                      <Link
                        href={`/dashboard/settings/permissions`}
                        title="Access Governance"
                        className="text-xs font-semibold text-slate-500 hover:text-indigo-600 transition"
                      >
                        Access
                      </Link>
                    )}
                    <Link
                      href={`/dashboard/employees/${emp.id}`}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 group-hover:translate-x-0.5 transition"
                    >
                      <span>360 Profile</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Table View */}
      {viewMode === 'table' && (
        <div className="border border-slate-200/80 rounded-2xl bg-white shadow-xs overflow-hidden text-xs">
          {/* Desktop Zero-Scroll Table */}
          <div className="hidden md:block w-full">
            <table className="w-full text-left border-collapse table-fixed">
              <colgroup>
                <col className="w-[22%]" />
                <col className="w-[24%]" />
                <col className="w-[24%]" />
                <col className="w-[16%]" />
                <col className="w-[14%]" />
              </colgroup>
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                <tr>
                  <th className="py-2.5 px-3">Employee</th>
                  <th className="py-2.5 px-3">Designation & Department</th>
                  <th className="py-2.5 px-3">Contact</th>
                  <th className="py-2.5 px-3">Location & Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEmployees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900 truncate">{emp.full_name}</div>
                      <div className="text-[10px] font-mono text-indigo-600">{emp.employee_id}</div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-800 truncate">{emp.designation}</div>
                      <div className="text-slate-400 text-[11px] truncate">{emp.department}</div>
                    </td>
                    <td className="py-3 px-3 space-y-0.5">
                      <div className="flex items-center gap-1 text-slate-600 truncate">
                        <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">{emp.corporate_email}</span>
                      </div>
                      <div className="flex items-center gap-1 text-slate-500 font-mono text-[11px] truncate">
                        <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">{emp.phone}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                        {emp.work_location_type}
                      </span>
                      <div className="inline-flex items-center gap-1 text-emerald-600 font-bold text-[11px] mt-1 ml-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        {emp.status}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        {canAddEmployee && (
                          <Link
                            href={`/dashboard/settings/permissions`}
                            className="p-1 rounded text-slate-400 hover:text-indigo-600 transition"
                            title="Review Access in Settings"
                          >
                            <Shield className="w-3.5 h-3.5" />
                          </Link>
                        )}
                        <Link
                          href={`/dashboard/employees/${emp.id}`}
                          className="px-2 py-1 rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-semibold transition"
                        >
                          Profile
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Employee Table Fallback Cards */}
          <div className="block md:hidden divide-y divide-slate-100">
            {filteredEmployees.map((emp) => (
              <div key={emp.id} className="p-4 space-y-2.5 bg-white">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{emp.full_name}</h4>
                    <span className="font-mono text-xs text-indigo-600 font-bold">{emp.employee_id}</span>
                  </div>
                  <span className="inline-flex items-center gap-1 text-emerald-600 font-bold text-[11px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    {emp.status}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs space-y-1">
                  <div className="font-semibold text-slate-800">{emp.designation} &bull; <span className="text-slate-500 font-normal">{emp.department}</span></div>
                  <div className="text-slate-500 text-[11px] flex items-center gap-2 pt-1 border-t border-slate-200/60">
                    <span>{emp.phone}</span>
                    <span>&bull;</span>
                    <span className="truncate">{emp.corporate_email}</span>
                  </div>
                </div>

                <Link
                  href={`/dashboard/employees/${emp.id}`}
                  className="w-full min-h-[44px] flex items-center justify-center gap-1.5 rounded-xl bg-indigo-50 text-indigo-700 font-bold text-xs"
                >
                  <span>View 360 Profile</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {filteredEmployees.length === 0 && (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200/80">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-800">No employees match your search criteria</h3>
          <p className="text-xs text-slate-400 mt-1">Try resetting the department or location filters.</p>
        </div>
      )}

      {/* Add Employee Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in fade-in-50 zoom-in-95">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Add New Employee Master Record</h3>
                <p className="text-[11px] text-slate-500">
                  Sequential EMP-XXXX identifier will be generated automatically.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200/50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              {errorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-xl flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. K. Vamshi"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Corporate Email *</label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. vamshi@icontechpro.in"
                    value={formData.corporate_email}
                    onChange={(e) => setFormData({ ...formData, corporate_email: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Phone Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="+91 98490 XXXXX"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Department *</label>
                  <select
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="Projects & Installations">Projects & Installations</option>
                    <option value="Technical Services">Technical Services</option>
                    <option value="Corporate Sales">Corporate Sales</option>
                    <option value="Field Sales">Field Sales</option>
                    <option value="Finance & Accounts">Finance & Accounts</option>
                    <option value="Service & Operations">Service & Operations</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Designation *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Lead AV Technician"
                    value={formData.designation}
                    onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Work Location *</label>
                  <select
                    value={formData.work_location_type}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        work_location_type: e.target.value as Employee['work_location_type'],
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="Office">Office Staff</option>
                    <option value="Site">Customer Site Staff</option>
                    <option value="Field">Field Sales / Mobility</option>
                    <option value="Hybrid">Hybrid</option>
                  </select>
                </div>

                {formData.work_location_type === 'Site' && (
                  <div className="sm:col-span-2">
                    <label className="block text-slate-700 font-semibold mb-1">Current Assigned Site</label>
                    <input
                      type="text"
                      placeholder="e.g. Swan Technologies Pvt Ltd - HITEC City"
                      value={formData.current_site_assignment}
                      onChange={(e) => setFormData({ ...formData, current_site_assignment: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                )}

                <div className="sm:col-span-2">
                  <label className="block text-slate-700 font-semibold mb-1">Skills (comma separated)</label>
                  <input
                    type="text"
                    placeholder="e.g. IFPD Wall Mounting, Projector Rigging, HDMI Cabling"
                    value={formData.skills}
                    onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Modal Actions */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg shadow-xs transition"
                >
                  {submitting ? 'Creating...' : 'Save Employee Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
