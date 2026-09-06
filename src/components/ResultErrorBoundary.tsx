/* حد أخطاء صفحة النتيجة — أي خلل تصيير في نتيجة قديمة/تالفة
   يتحول لحالة استعادة مفهومة بدل صفحة فارغة. */

import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { RotateCcw, Home } from "lucide-react";
import { Link } from "react-router";

import Button from "@/components/ui/Button";
interface Props {
  children: ReactNode;
  onReset: () => void;
}

interface State {
  hasError: boolean;
}

export class ResultErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("تعطل عرض النتيجة المحفوظة:", error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <section className="mx-auto max-w-xl px-5 py-20 text-center">
        <h1 className="text-2xl font-black">تعذر عرض نتيجتك السابقة</h1>
        <p className="mt-4 text-sm leading-loose text-muted-foreground">
          حدث خلل أثناء قراءة النتيجة المحفوظة على جهازك — إجاباتك بأمان،
          وأعد التشخيص من جديد ولن يأخذ أكثر من دقائق.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button
            onClick={() => {
              this.setState({ hasError: false });
              this.props.onReset();
            }}
            className="h-12 rounded-full bg-gold px-8 font-black text-on-gold hover:bg-gold/90"
          >
            <RotateCcw className="ml-2 h-4 w-4" />
            أعد التشخيص من جديد
          </Button>
          <Link to="/">
            <Button variant="outline" className="h-12 rounded-full border-white/20 px-8 font-black text-foreground hover:bg-white/5">
              <Home className="ml-2 h-4 w-4" />
              العودة للرئيسية
            </Button>
          </Link>
        </div>
      </section>
    );
  }
}
