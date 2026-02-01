import { Search } from 'lucide-react';
import { Input } from './ui/input';

export default function TableSearchBox({ value, onChange, placeholder = "Search..." }) {
  return (
    <div className="relative max-w-xs">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        placeholder={placeholder}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="pl-9 h-9"
      />
    </div>
  );
}

