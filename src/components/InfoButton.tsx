import { createSignal } from 'solid-js'
import {getEmoji} from "@/components/GetEmoji";

// Information Button Component with Tooltip
export const InfoButton = (props) => {
  const [tooltipVisible, setTooltipVisible] = createSignal(false)

  const toggleTooltip = () => setTooltipVisible(!tooltipVisible())

  return (
    <span style={{ position: 'relative', ...props.style }}>
      <button
        style={{ border: 'none', background: 'none', cursor: 'pointer' }}
        onClick={toggleTooltip}
      >
        <b>ⓘ</b>
      </button>
      {tooltipVisible() && (
        <div
          style={{
            'position': 'absolute',
            'top': '100%',
            'left': '50%',
            'transform': 'translateX(-50%)',
            'border': '1px solid gray',
            'padding': '10px',
            'background': 'white',
            'border-radius': '5px',
            'color': 'black',
            'width': '300px', // Adjust width as necessary
            'z-index': 10, // Ensures tooltip is above other content
          }}
        >
          <strong>NLP 감정 탐지 (NLP Emotion Detection):</strong><br />
          이 도구는 자연어 처리 (natural language processing)를 사용하여 텍스트를 분석하고 감정의 강도에 따라 감정을 식별합니다. 감지된 감정은 각각의 강도에 따라 조정된 해당
          이모티콘으로 시각화됩니다. 탐지할 수 있는 감정 목록은 다음과 같습니다:
          <p>This tool utilizes natural language processing to analyze texts and identify emotions based on their
            intensity. Each detected emotion is visualized with an emoji adjusted to reflect its intensity (bigger emoji equals bigger emotion). The list
            above displays the emotions that can be detected.
          </p>
          <br />
          <ul>
            <li>화남 (Angry): {getEmoji('angry')}</li>
            <li>혐오 (Disgust): {getEmoji('disgust')}</li>
            <li>두려움 (Fear): {getEmoji('fear')}</li>
            <li>행복 (Happy): {getEmoji('happy')}</li>
            <li>중립 (Neutral): {getEmoji('neutral')}</li>
            <li>슬픔 (Sad): {getEmoji('sad')}</li>
            <li>놀람 (Surprise): {getEmoji('surprise')}</li>
          </ul>
        </div>
      )}
    </span>
  )
}
