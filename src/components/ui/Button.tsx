import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'ghost' | 'outline' | 'destructive' | 'secondary' | 'link';
  size?: 'default' | 'sm' | 'md' | 'lg' | 'icon';
}

export function Button({ variant = 'default', size = 'default', className = '', children, ...props }: ButtonProps) {
  const base = 'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';

  const variants = {
    default: 'bg-blue-600 text-white hover:bg-blue-700',
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    ghost: 'hover:bg-slate-800 hover:text-white text-slate-400',
    outline: 'border border-slate-700 bg-transparent hover:bg-slate-800 text-slate-300',
    destructive: 'bg-red-600 text-white hover:bg-red-700',
    secondary: 'bg-slate-800 text-white hover:bg-slate-700',
    link: 'text-blue-400 underline-offset-4 hover:underline',
  };

  const sizes = {
    default: 'h-10 px-4 py-2 text-sm',
    sm: 'h-9 px-3 text-xs',
    md: 'h-10 px-4 py-2 text-sm',
    lg: 'h-11 px-8 text-base',
    icon: 'h-10 w-10',
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
