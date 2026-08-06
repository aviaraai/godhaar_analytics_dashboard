import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { TriangleAlertIcon } from "lucide-react";

type ErrorAlertProps = {
  message: string;
  onDismiss: () => void;
  title?: string;
};

/**
 * Controlled rather than `defaultOpen`, so a second failure re-opens the dialog
 * instead of staying shut because the user dismissed the first one.
 */
export default function ErrorAlert({
  message,
  onDismiss,
  title = "Could not load analytics",
}: ErrorAlertProps) {
  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (!open) onDismiss();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <TriangleAlertIcon className="text-destructive" />
          </AlertDialogMedia>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{message}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Ok</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
