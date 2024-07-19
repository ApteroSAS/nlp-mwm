export const Paper = (props) => {
  return (
    <div
      style="padding: 3px;
      background: #4682B4;
      box-shadow: 0px 2px 1px -1px rgba(0,0,0,0.2), 0px 1px 1px 0px rgba(0,0,0,0.14), 0px 1px 3px 0px rgba(0,0,0,0.12); border-radius: 4px"
    >
      {props.children}
    </div>
  )
}
