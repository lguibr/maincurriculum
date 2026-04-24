const fs = require('fs');
const files = [
  'src/features/onboarding/components/OnboardingHeader.tsx',
  'src/features/memory/components/EntityEditor.tsx',
  'src/features/memory/components/SidebarCategory.tsx',
  'src/features/improve/components/ImproveChat.tsx',
  'src/features/timeline/components/MermaidChart.tsx'
];

files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  content = content.replace(/\\`/g, '`');
  content = content.replace(/\\\$/g, '$');
  fs.writeFileSync(f, content);
});
