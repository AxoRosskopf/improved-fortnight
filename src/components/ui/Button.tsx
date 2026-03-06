import styles from './Button.module.css';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'icon';
  children: React.ReactNode;
}

export default function Button({ variant = 'primary', children, className, ...props }: ButtonProps) {
  const variantClass = styles[variant];
  return (
    <button
      className={`${styles.button} ${variantClass}${className ? ` ${className}` : ''}`}
      {...props}
    >
      {children}
    </button>
  );
}
