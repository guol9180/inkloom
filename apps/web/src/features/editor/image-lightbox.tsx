import Lightbox from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import "yet-another-react-lightbox/styles.css";

export function ImageLightbox({
  src,
  onClose
}: {
  src: string;
  onClose: () => void;
}) {
  return (
    <Lightbox
      open
      close={onClose}
      slides={[{ src }]}
      plugins={[Zoom]}
      zoom={{ maxZoomPixelRatio: 4, scrollToZoom: true }}
      carousel={{ finite: true }}
      controller={{ closeOnBackdropClick: true }}
      labels={{
        Lightbox: "图片预览",
        "Photo gallery": "图片预览",
        Close: "关闭图片预览",
        "Zoom in": "放大",
        "Zoom out": "缩小",
        "{index} of {total}": "第 {index} 张，共 {total} 张"
      }}
      render={{ buttonPrev: () => null, buttonNext: () => null }}
    />
  );
}
