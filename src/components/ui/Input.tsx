import styles from './Input.module.css';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
}

export default function Input({ iconLeft, iconRight, className, ...props }: InputProps) {
  return (
    <div className={styles.wrapper}>
      {iconLeft && <span className={styles.iconLeft}>{iconLeft}</span>}
      <input
        className={`${styles.input}${className ? ` ${className}` : ''}`}
        {...props}
      />
      {iconRight && <span className={styles.iconRight}>{iconRight}</span>}
    </div>
  );
}
