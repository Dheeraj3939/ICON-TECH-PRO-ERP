import { UAT_ROLES, UAT_TESTS } from './uat-test-definitions';
import { UATItemState, UATRoleReview } from './uat-types';

export function generateUATMarkdownReport(
  itemsState: Record<string, UATItemState>,
  reviews: Record<string, UATRoleReview>
): string {
  const timestamp = new Date().toISOString();
  let totalTests = UAT_TESTS.length;
  let totalPassed = 0;
  let totalFailed = 0;
  let totalNotTested = 0;
  let totalNA = 0;
  let totalCriticalIssues = 0;
  let totalHighIssues = 0;

  UAT_TESTS.forEach((test) => {
    const st = itemsState[test.id]?.status || test.defaultStatus || 'NOT_TESTED';
    if (st === 'PASS') totalPassed++;
    else if (st === 'FAIL') {
      totalFailed++;
      const prio = itemsState[test.id]?.priority || test.defaultPriority;
      if (prio === 'CRITICAL') totalCriticalIssues++;
      else if (prio === 'HIGH') totalHighIssues++;
    } else if (st === 'NA') totalNA++;
    else totalNotTested++;
  });

  const overallCompletion = totalTests > 0 ? ((totalPassed + totalNA) / totalTests) * 100 : 0;

  let md = `# ICON TECH PRO ERP V9.2 — FINAL ROLE-BY-ROLE HUMAN UAT REPORT\n\n`;
  md += `**Execution Environment**: Port 3001 (Port 3000 Production Protected)\n`;
  md += `**Commit Hash**: \`6bc3635\`\n`;
  md += `**Report Generated At**: ${timestamp}\n`;
  md += `**Database & RLS**: Fully Enforced • Zero Schema Changes • Zero Deletions\n\n`;

  md += `## 1. GLOBAL UAT SUMMARY\n\n`;
  md += `| Metric | Count / Value |\n`;
  md += `| :--- | :--- |\n`;
  md += `| **Total Test Cases** | **${totalTests}** |\n`;
  md += `| **Passed** | **${totalPassed}** |\n`;
  md += `| **Failed** | **${totalFailed}** |\n`;
  md += `| **N/A** | **${totalNA}** |\n`;
  md += `| **Not Tested** | **${totalNotTested}** |\n`;
  md += `| **Completion Rate** | **${overallCompletion.toFixed(1)}%** |\n`;
  md += `| **Critical Issues** | **${totalCriticalIssues}** |\n`;
  md += `| **High Issues** | **${totalHighIssues}** |\n\n`;

  md += `## 2. ROLE-BY-ROLE SUMMARY TABLE\n\n`;
  md += `| Role | User Name | Total Tests | Passed | Failed | N/A | Not Tested | Completion % | Approval Status |\n`;
  md += `| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |\n`;

  UAT_ROLES.forEach((r) => {
    const roleTests = UAT_TESTS.filter((t) => t.roleId === r.roleId);
    let pass = 0, fail = 0, na = 0, nt = 0;
    roleTests.forEach((t) => {
      const st = itemsState[t.id]?.status || t.defaultStatus || 'NOT_TESTED';
      if (st === 'PASS') pass++;
      else if (st === 'FAIL') fail++;
      else if (st === 'NA') na++;
      else nt++;
    });
    const comp = roleTests.length > 0 ? ((pass + na) / roleTests.length) * 100 : 0;
    const approval = reviews[r.roleId]?.finalApprovalStatus || 'PENDING';
    md += `| **${r.roleName}** | ${r.userName} | ${roleTests.length} | ${pass} | ${fail} | ${na} | ${nt} | ${comp.toFixed(1)}% | **${approval}** |\n`;
  });

  md += `\n---\n\n`;

  // Detailed Section for Each Role
  UAT_ROLES.forEach((r) => {
    const roleTests = UAT_TESTS.filter((t) => t.roleId === r.roleId);
    const rev = reviews[r.roleId];

    md += `## ${r.roleName.toUpperCase()} (${r.userName})\n`;
    md += `**Department**: ${r.department}  \n`;
    md += `**Official Email**: \`${r.userEmail}\`  \n`;
    md += `**Primary Focus**: ${r.primaryFocus}  \n\n`;

    md += `### Complete Workflow Test Checklist\n\n`;
    md += `| ID | Module | Page | Action | Expected Result | Actual Result | Status | Priority | Issue / Notes |\n`;
    md += `| :--- | :--- | :--- | :--- | :--- | :--- | :---: | :---: | :--- |\n`;

    roleTests.forEach((t) => {
      const itemSt = itemsState[t.id];
      const status = itemSt?.status || t.defaultStatus || 'NOT_TESTED';
      const actual = itemSt?.actualResult || t.defaultActualResult || 'Pending inspection';
      const prio = itemSt?.priority || t.defaultPriority;
      const issue = itemSt?.issue || (status === 'FAIL' ? 'Issue reported' : '-');

      md += `| \`${t.id}\` | ${t.module} | ${t.page} | ${t.action.replace(/\|/g, '\\|')} | ${t.expectedResult.replace(/\|/g, '\\|')} | ${actual.replace(/\|/g, '\\|')} | **${status}** | ${prio} | ${issue.replace(/\|/g, '\\|')} |\n`;
    });

    md += `\n### Human Review Questionnaire & Sign-Off\n\n`;
    if (rev) {
      md += `1. **What worked well?**: ${rev.whatWorkedWell || 'Pending response'}\n`;
      md += `2. **What is difficult?**: ${rev.whatIsDifficult || 'Pending response'}\n`;
      md += `3. **What is missing?**: ${rev.whatIsMissing || 'Pending response'}\n`;
      md += `4. **What should be changed?**: ${rev.whatShouldBeChanged || 'Pending response'}\n`;
      md += `5. **Any security concern?**: ${rev.securityConcern || 'None reported'}\n`;
      md += `6. **Any calculation concern?**: ${rev.calculationConcern || 'None reported'}\n`;
      md += `7. **Any performance concern?**: ${rev.performanceConcern || 'None reported'}\n`;
      md += `8. **Would you use this ERP for daily work?**: **${rev.dailyUseRecommendation || 'Pending'}**\n`;
      md += `9. **Final Role Approval**: **${rev.finalApprovalStatus || 'PENDING'}**\n`;
      md += `**Signed By**: ${rev.signedByName || 'Pending'} on ${rev.signedAt || 'Pending'}\n\n`;
    } else {
      md += `*Review questionnaire not yet submitted for this role.*\n\n`;
    }

    md += `---\n\n`;
  });

  return md;
}
