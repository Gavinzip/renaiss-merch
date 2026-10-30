import prefix from 'postcss-prefix-selector';

export default { plugins: [prefix({ prefix: '.fair-proof', includeFiles: [/PublicVerification\/(golden|fair\/.*)\.css$/],
  transform(scope, selector, prefixed, _file, rule) {
    if (rule.parent?.type === 'atrule' && /keyframes$/.test(rule.parent.name)) return selector;
    if (selector.includes('&')) return selector;
    if (selector.startsWith(scope)) return selector;
    if (/^(:root|:host|html|body)(?=$|[\s.:\[])/.test(selector)) return selector.replace(/^(:root|:host|html|body)/, scope);
    return prefixed;
  },
})] };
